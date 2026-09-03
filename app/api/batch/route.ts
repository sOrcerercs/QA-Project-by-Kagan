import { NextRequest, NextResponse } from "next/server";
import { $Enums } from "@/app/generated/prisma";
import prisma from "@/app/lib/prisma";
import { extractReportJson, reportJsonFields } from "@/app/lib/reportJson";
import { getUserFromToken } from "@/app/lib/auth";
import { detectCallType } from "@/app/lib/callTypeDetector";
import { shouldForceFirstCall } from "@/app/lib/evaluationRules";

// Düşünme açık olduğu için bu çağrılar ~40-60 sn sürebiliyor. Bu route'u
// çağıran senkron/cron yolları zaten maxDuration = 300 kullanıyor;
// analiz tarafı daha düşük bir platform varsayılanında kalırsa
// zincirin en zayıf halkası burası olur.
export const maxDuration = 300;

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(
  systemPrompt: string,
  userMessage: string,
  maxOutputTokens: number,
  temperature = 0,
  thinkingBudget = 0
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY tanımlı değil.");

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: { maxOutputTokens, temperature, thinkingConfig: { thinkingBudget } },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini API hatası: ${res.status} — ${errText.slice(0, 150)}`);
  }

  const data = await res.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini boş yanıt döndürdü.");
  return text;
}

// Batch durumu sorgula
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Batch ID gerekli." }, { status: 400 });

  const evaluations = await prisma.evaluation.findMany({
    where: { promptId: id },
    select: { id: true, score: true },
  });

  return NextResponse.json({ processed: evaluations.length });
}

// Batch analiz başlat
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "Sunucu yapılandırma hatası." }, { status: 500 });
  }

  const { calls } = await req.json();

  if (!calls || !Array.isArray(calls) || calls.length === 0) {
    return NextResponse.json({ error: "Çağrı listesi boş." }, { status: 400 });
  }

  if (calls.length > 50) {
    return NextResponse.json({ error: "Maksimum 50 çağrı gönderilebilir." }, { status: 400 });
  }

  const results: { index: number; success: boolean; score?: number; error?: string }[] = [];

  for (let i = 0; i < calls.length; i++) {
    const call = calls[i];

    if (!call.transcript || call.transcript.trim().length < 50) {
      results.push({ index: i, success: false, error: "Transkript çok kısa" });
      continue;
    }

    try {
      let callType = call.callType || "AUTO";
      let activePrompt: Awaited<ReturnType<typeof prisma.prompt.findFirst>> | null = null;

      if (call.promptId) {
        activePrompt = await prisma.prompt.findUnique({ where: { id: call.promptId } });
        if (!activePrompt) {
          results.push({ index: i, success: false, error: "Belirtilen prompt bulunamadı" });
          continue;
        }
        callType = activePrompt.callType;
      } else {
        if (callType === "AUTO") {
          callType = await detectCallType(call.transcript);
        }

        activePrompt = await prisma.prompt.findFirst({
          where: { callType: callType as $Enums.CallType, isActive: true },
        });

        if (!activePrompt) {
          activePrompt = await prisma.prompt.findFirst({ where: { isActive: true } });
        }

        if (!activePrompt) {
          results.push({ index: i, success: false, error: "Aktif prompt bulunamadı. Lütfen admin panelinden prompt ekleyin." });
          continue;
        }
      }

      const resolvedAgent = call.agentId
        ? await prisma.user.findUnique({ where: { id: call.agentId }, include: { team: true } })
        : call.agentName
          ? await prisma.user.findFirst({ where: { name: { contains: call.agentName } }, include: { team: true } })
          : null;
      const resolvedAgentId = resolvedAgent?.id ?? user.id;
      const resolvedTeamName = resolvedAgent?.team?.name || "Belirtilmedi";

      // Forced rule: members of Sümeyra Demir's team (and the leader) are always
      // evaluated with the First Call prompt, overriding AUTO/detected type.
      if (await shouldForceFirstCall(resolvedAgent?.id)) {
        callType = "FIRST_CALL";
        const forcedPrompt = await prisma.prompt.findFirst({ where: { callType: "FIRST_CALL", isActive: true } });
        if (forcedPrompt) activePrompt = forcedPrompt;
      }

      const fullPrompt = `${activePrompt.content}

=== DEĞERLENDİRİLECEK GÖRÜŞME BİLGİLERİ ===
Temsilci Adı: ${call.agentName || "Belirtilmedi"}
Takım: ${resolvedTeamName}
Müşteri Adı: ${call.customerName || "Belirtilmedi"}
Görüşme Süresi: ${call.callDuration || "Belirtilmedi"}
Değerlendirme Tarihi: ${new Date().toLocaleString("tr-TR", { month: "long", year: "numeric" })}

=== TRANSKRİPT ===
${call.transcript}

Yukarıdaki transkripti kurallara göre değerlendir ve ZORUNLU ÇIKTI FORMATINDA Türkçe rapor üret.`;

      // Toplu yükleme döngüde çalışıyor; düşünme açık olsa istek tavanına
      // sığmaz. Kalite gereken kayıtlar tek tek "yeniden sınıflandır" ile
      // düşünmeli yoldan geçirilir.
      const reportText = await callGemini("Sen bir satış koçusun.", fullPrompt, 65536, 0);

      const extracted = extractReportJson(reportText);
      const { cleanReport, score } = extracted;

      const evaluation = await prisma.evaluation.create({
        data: {
          agentId: resolvedAgentId,
          customerName: call.customerName || "Belirtilmedi",
          callDuration: call.callDuration || "Belirtilmedi",
          transcript: call.transcript,
          report: cleanReport,
          score,
          callType: callType as $Enums.CallType,
          promptId: activePrompt.id,
          ...reportJsonFields(extracted),
        },
      });

      const notifyIds = new Set<string>([resolvedAgentId]);
      const teamLeaderId = resolvedAgent?.team
        ? (await prisma.team.findUnique({ where: { id: resolvedAgent.team.id }, select: { leaderId: true } }))?.leaderId
        : null;
      if (teamLeaderId) notifyIds.add(teamLeaderId);

      await prisma.notification.createMany({
        data: [...notifyIds].map((uid) => ({
          userId: uid,
          type: "EVALUATION",
          message: `${call.customerName || "Müşteri"} için değerlendirme tamamlandı. Skor: %${score}`,
          referenceId: evaluation.id,
        })),
        skipDuplicates: true,
      });

      results.push({ index: i, success: true, score });

      if (i < calls.length - 1) await new Promise(r => setTimeout(r, 1000));

    } catch (err) {
      results.push({ index: i, success: false, error: err instanceof Error ? err.message : "Bilinmeyen hata" });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return NextResponse.json({ total: calls.length, success: successCount, failed: failCount, results });
}
