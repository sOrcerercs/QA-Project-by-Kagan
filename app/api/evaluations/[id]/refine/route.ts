import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

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

  if (!process.env.GROQ_API_KEY) {
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

  const groqResponse = await fetch("https://api.groq.com/openai/v1/chat/completions", {
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

  if (!groqResponse.ok) {
    const errText = await groqResponse.text();
    console.error("Groq API error:", errText);
    return NextResponse.json({ error: "AI servisi geçici olarak kullanılamıyor." }, { status: 500 });
  }

  const groqData = await groqResponse.json();
  const reportText: string = groqData.choices[0].message.content;

  // Parse JSON_DATA block from refine response
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
}
