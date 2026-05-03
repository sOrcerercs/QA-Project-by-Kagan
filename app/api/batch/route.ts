import { NextRequest, NextResponse } from "next/server";
import { $Enums } from "@prisma/client";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

// Batch durumu sorgula
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "Batch ID gerekli." }, { status: 400 });

  // Batch durumunu evaluation sayısından hesapla
  // BatchJob modeli yerine basit bir yaklaşım: evaluations üzerinden takip
  const evaluations = await prisma.evaluation.findMany({
    where: { promptId: id }, // batchId olarak promptId alanını geçici kullanıyoruz
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

  const { calls } = await req.json();

  if (!calls || !Array.isArray(calls) || calls.length === 0) {
    return NextResponse.json({ error: "Çağrı listesi boş." }, { status: 400 });
  }

  if (calls.length > 50) {
    return NextResponse.json({ error: "Maksimum 50 çağrı gönderilebilir." }, { status: 400 });
  }

  // Her çağrıyı sırayla analiz et
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

      // promptId doğrudan geldiyse call type tespitini atla
      if (call.promptId) {
        activePrompt = await prisma.prompt.findUnique({ where: { id: call.promptId } });
        if (!activePrompt) {
          results.push({ index: i, success: false, error: "Belirtilen prompt bulunamadı" });
          continue;
        }
        callType = activePrompt.callType;
      } else {
        // Çağrı tipini belirle
        if (callType === "AUTO") {
          const classifyRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [
                {
                  role: "system",
                  content: "Sen bir satış çağrısı sınıflandırıcısısın. YALNIZCA şu kelimelerden birini yaz: FIRST_CALL, SECOND_CALL, FOLLOW_UP, GENERAL",
                },
                { role: "user", content: call.transcript.slice(0, 500) },
              ],
              max_tokens: 10,
              temperature: 0,
            }),
          });

          if (classifyRes.ok) {
            const classifyData = await classifyRes.json();
            const detected = classifyData.choices[0].message.content.trim();
            const validTypes = ["FIRST_CALL", "SECOND_CALL", "FOLLOW_UP", "GENERAL"];
            callType = validTypes.includes(detected) ? detected : "SECOND_CALL";
          } else {
            callType = "SECOND_CALL";
          }
        }

        // Aktif prompt'u çek — yoksa herhangi bir aktif prompta fall back yap
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

      // Agent ve takım bilgisini çöz
      const resolvedAgent = call.agentId
        ? await prisma.user.findUnique({ where: { id: call.agentId }, include: { team: true } })
        : call.agentName
          ? await prisma.user.findFirst({ where: { name: { contains: call.agentName } }, include: { team: true } })
          : null;
      const resolvedAgentId = resolvedAgent?.id ?? user.id;
      const resolvedTeamName = resolvedAgent?.team?.name || "Belirtilmedi";

      // Analiz yap
      const fullPrompt = `${activePrompt.content}

=== DEĞERLENDİRİLECEK GÖRÜŞME BİLGİLERİ ===
Temsilci Adı: ${call.agentName || "Belirtilmedi"}
Takım: ${resolvedTeamName}
Müşteri Adı: ${call.customerName || "Belirtilmedi"}
Görüşme Süresi: ${call.callDuration || "Belirtilmedi"}
Değerlendirme Tarihi: Nisan 2026

=== TRANSKRİPT ===
${call.transcript}

Yukarıdaki transkripti kurallara göre değerlendir ve ZORUNLU ÇIKTI FORMATINDA Türkçe rapor üret.`;

      const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          messages: [{ role: "user", content: fullPrompt }],
          max_tokens: 4000,
          temperature: 0.3,
        }),
      });

      if (!groqRes.ok) {
        // Rate limit — retry once after 3s
        if (groqRes.status === 429) {
          await new Promise(r => setTimeout(r, 3000));
          const retryRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
            },
            body: JSON.stringify({
              model: "llama-3.3-70b-versatile",
              messages: [{ role: "user", content: fullPrompt }],
              max_tokens: 4000,
              temperature: 0.3,
            }),
          });
          if (!retryRes.ok) {
            results.push({ index: i, success: false, error: "Rate limit" });
            continue;
          }
          const retryData = await retryRes.json();
          const reportText = retryData.choices[0].message.content;
          const scoreMatch = reportText.match(/(?:Genel Skor|Puan):[^0-9\n]*(\d+(?:[.,]\d+)?)/i);
          const score = scoreMatch ? Math.round(parseFloat(scoreMatch[1].replace(",", "."))) : 0;

          const retryEval = await prisma.evaluation.create({
            data: {
              agentId: resolvedAgentId,
              customerName: call.customerName || "Belirtilmedi",
              callDuration: call.callDuration || "Belirtilmedi",
              transcript: call.transcript,
              report: reportText,
              score,
              callType: callType as $Enums.CallType,
              promptId: activePrompt.id,
            },
          });
          const retryNotifyIds = new Set<string>([resolvedAgentId]);
          const retryTlId = resolvedAgent?.team
            ? (await prisma.team.findUnique({ where: { id: resolvedAgent.team.id }, select: { leaderId: true } }))?.leaderId
            : null;
          if (retryTlId) retryNotifyIds.add(retryTlId);
          await prisma.notification.createMany({
            data: [...retryNotifyIds].map((uid) => ({
              userId: uid,
              type: "EVALUATION",
              message: `${call.customerName || "Müşteri"} için değerlendirme tamamlandı. Skor: %${score}`,
              referenceId: retryEval.id,
            })),
            skipDuplicates: true,
          });
          results.push({ index: i, success: true, score });
          continue;
        }
        const errBody = await groqRes.text().catch(() => "");
        const errDetail = errBody ? ` (${groqRes.status}: ${errBody.slice(0, 120)})` : ` (${groqRes.status})`;
        results.push({ index: i, success: false, error: `API hatası${errDetail}` });
        continue;
      }

      const groqData = await groqRes.json();
      const reportText = groqData.choices[0].message.content;
      const scoreMatch = reportText.match(/(?:Genel Skor|Puan):[^0-9\n]*(\d+(?:[.,]\d+)?)/i);
      const score = scoreMatch ? Math.round(parseFloat(scoreMatch[1].replace(",", "."))) : 0;

      const evaluation = await prisma.evaluation.create({
        data: {
          agentId: resolvedAgentId,
          customerName: call.customerName || "Belirtilmedi",
          callDuration: call.callDuration || "Belirtilmedi",
          transcript: call.transcript,
          report: reportText,
          score,
          callType: callType as $Enums.CallType,
          promptId: activePrompt.id,
        },
      });

      // Notify agent + team leader
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

      // Rate limit koruması: çağrılar arası 2sn bekle
      if (i < calls.length - 1) {
        await new Promise(r => setTimeout(r, 2000));
      }

    } catch (err) {
      results.push({ index: i, success: false, error: err instanceof Error ? err.message : "Bilinmeyen hata" });
    }
  }

  const successCount = results.filter(r => r.success).length;
  const failCount = results.filter(r => !r.success).length;

  return NextResponse.json({
    total: calls.length,
    success: successCount,
    failed: failCount,
    results,
  });
}
