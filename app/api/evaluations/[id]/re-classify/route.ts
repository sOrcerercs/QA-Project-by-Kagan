// app/api/evaluations/[id]/re-classify/route.ts
import { NextRequest, NextResponse } from "next/server";
import { $Enums } from "@/app/generated/prisma";
import prisma from "@/app/lib/prisma";
import { extractReportJson, reportJsonFields } from "@/app/lib/reportJson";
import { getUserFromToken } from "@/app/lib/auth";
import { SCORING_THINKING_BUDGET } from "@/app/lib/gemini";

// Düşünme açık olduğu için bu çağrılar ~40-60 sn sürebiliyor. Bu route'u
// çağıran senkron/cron yolları zaten maxDuration = 300 kullanıyor;
// analiz tarafı daha düşük bir platform varsayılanında kalırsa
// zincirin en zayıf halkası burası olur.
export const maxDuration = 300;

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function callGemini(systemPrompt: string, userMessage: string): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY tanımlı değil.");

  const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents: [{ parts: [{ text: userMessage }] }],
      generationConfig: {
        maxOutputTokens: 65536,
        // Rubrik uygulayan çağrı — bkz. SCORING_THINKING_BUDGET (gemini.ts).
        temperature: 0,
        thinkingConfig: { thinkingBudget: SCORING_THINKING_BUDGET },
      },
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`Gemini API hatası: ${res.status} — ${errText.slice(0, 150)}`);
  }

  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Gemini boş yanıt döndürdü.");
  return text;
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
  }

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "Sunucu yapılandırma hatası." }, { status: 500 });
  }

  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  const callType: string = body.callType;

  if (callType !== "FIRST_CALL" && callType !== "SECOND_CALL") {
    return NextResponse.json({ error: "Geçersiz callType." }, { status: 400 });
  }

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: { agent: { select: { name: true, team: { select: { name: true } } } } },
  });
  if (!evaluation) {
    return NextResponse.json({ error: "Değerlendirme bulunamadı." }, { status: 404 });
  }

  // Fetch active prompt for the requested call type
  let activePrompt = await prisma.prompt.findFirst({
    where: { callType: callType as $Enums.CallType, isActive: true },
  });

  if (!activePrompt) {
    // Fallback: any active prompt
    activePrompt = await prisma.prompt.findFirst({ where: { isActive: true } });
    if (activePrompt) {
      console.warn(`re-classify: no active prompt for ${callType}, falling back to ${activePrompt.callType}`);
    }
  }

  if (!activePrompt) {
    return NextResponse.json({ error: "Aktif prompt bulunamadı." }, { status: 404 });
  }

  const teamName = evaluation.agent?.team?.name || "Belirtilmedi";
  const fullPrompt = `${activePrompt.content}

=== DEĞERLENDİRİLECEK GÖRÜŞME BİLGİLERİ ===
Temsilci Adı: ${evaluation.agent?.name ?? "Belirtilmedi"}
Takım: ${teamName}
Müşteri Adı: ${evaluation.customerName}
Görüşme Süresi: ${evaluation.callDuration}
Değerlendirme Tarihi: ${new Date().toLocaleString("tr-TR", { month: "long", year: "numeric" })}

=== TRANSKRİPT ===
${evaluation.transcript}

Yukarıdaki transkripti kurallara göre değerlendir ve ZORUNLU ÇIKTI FORMATINDA Türkçe rapor üret.`;

  try {
    const reportText = await callGemini("Sen bir satış koçusun.", fullPrompt);

    const extracted = extractReportJson(reportText);
    const { cleanReport, scoreRaw: rawScore } = extracted;
    const score = rawScore !== null && rawScore >= 0 && rawScore <= 100 ? rawScore : evaluation.score;

    const updated = await prisma.evaluation.update({
      where: { id },
      data: {
        callType: callType as $Enums.CallType,
        promptId: activePrompt.id,
        report: cleanReport,
        score,
        ...reportJsonFields(extracted),
      },
    });

    return NextResponse.json({
      report: updated.report,
      score: updated.score,
      callType: updated.callType,
      sectionScores: updated.sectionScores,
      weakCriteria: updated.weakCriteria,
      reportData: updated.reportData,
    });
  } catch (error: any) {
    console.error("re-classify error:", error.message);
    return NextResponse.json({ error: "AI servisi hatası." }, { status: 500 });
  }
}
