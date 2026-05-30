import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  }
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
  }

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "Sunucu yapılandırma hatası." }, { status: 500 });
  }

  const { id } = await params;
  const body = await req.json();
  const feedback: string = body.feedback ?? "";

  if (!feedback.trim()) {
    return NextResponse.json({ error: "Feedback boş olamaz." }, { status: 400 });
  }

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: { agent: { select: { name: true } } },
  });
  if (!evaluation) {
    return NextResponse.json({ error: "Değerlendirme bulunamadı." }, { status: 404 });
  }

  if (!evaluation.promptId) {
    return NextResponse.json(
      { error: "Bu değerlendirme için prompt bulunamadı." },
      { status: 400 }
    );
  }

  const prompt = await prisma.prompt.findUnique({ where: { id: evaluation.promptId } });
  if (!prompt) {
    return NextResponse.json({ error: "Prompt bulunamadı." }, { status: 404 });
  }

  const fullPrompt = `${prompt.content}

=== DEĞERLENDİRİLECEK GÖRÜŞME BİLGİLERİ ===
Temsilci Adı: ${evaluation.agent?.name ?? "Belirtilmedi"}
Müşteri Adı: ${evaluation.customerName}
Görüşme Süresi: ${evaluation.callDuration}

=== TRANSKRİPT ===
${evaluation.transcript}

=== YÖNETİCİ NOTU ===
${feedback}
Bu notu dikkate alarak değerlendirmeyi yeniden yap ve ZORUNLU ÇIKTI FORMATINDA Türkçe rapor üret.`;

  try {
    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${process.env.GOOGLE_AI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Sen bir satış koçusun." }] },
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: { maxOutputTokens: 65536, temperature: 0.3, thinkingConfig: { thinkingBudget: 0 } },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      console.error("Gemini refine error:", geminiRes.status, errText);
      return NextResponse.json({ error: "AI servisi geçici olarak kullanılamıyor." }, { status: 500 });
    }

    const geminiData = await geminiRes.json();
    const reportText: string = geminiData.candidates?.[0]?.content?.parts?.[0]?.text ?? "";

    if (!reportText) {
      return NextResponse.json({ error: "AI boş yanıt döndürdü." }, { status: 500 });
    }

    const refineJsonMatch = reportText.match(/===JSON_DATA===([\s\S]*?)===END_JSON===/);
    let refinedSectionScores = null;
    let refinedWeakCriteria = null;
    if (refineJsonMatch) {
      try {
        const parsed = JSON.parse(refineJsonMatch[1].trim());
        if (parsed.sectionScores) refinedSectionScores = parsed.sectionScores;
        if (Array.isArray(parsed.weakCriteria)) refinedWeakCriteria = parsed.weakCriteria;
      } catch { /* parse failed — keep existing values */ }
    }

    const cleanRefineReport = reportText.replace(/\n*===JSON_DATA===[\s\S]*?===END_JSON===/g, "").trim();
    const scoreMatch = cleanRefineReport.match(/(?:Genel Skor|Puan):[^0-9\n]*(\d+(?:[.,]\d+)?)/i);
    const rawScore = scoreMatch ? Math.round(parseFloat(scoreMatch[1].replace(",", "."))) : null;
    const score = rawScore !== null && rawScore >= 0 && rawScore <= 100 ? rawScore : evaluation.score;

    const updated = await prisma.evaluation.update({
      where: { id },
      data: {
        report: cleanRefineReport,
        score,
        ...(refinedSectionScores && { sectionScores: refinedSectionScores }),
        ...(refinedWeakCriteria && refinedWeakCriteria.length > 0 && { weakCriteria: refinedWeakCriteria }),
      },
    });

    return NextResponse.json({ report: updated.report, score: updated.score });
  } catch (error: any) {
    console.error("Refine route error:", error.message);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
