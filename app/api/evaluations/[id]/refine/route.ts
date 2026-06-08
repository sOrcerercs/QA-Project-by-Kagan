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

  // Surgical refine: this is NOT a re-evaluation. We hand the model the already
  // completed report + its structured data and ask it to apply ONLY the change
  // the manager note requests, leaving every other criterion byte-for-byte the
  // same. (Re-running the full rubric made the AI re-judge unrelated items and
  // regress ones that previously passed.)
  const fullPrompt = `Aşağıda TAMAMLANMIŞ bir satış görüşmesi değerlendirme raporu var. Görevin bu raporu SIFIRDAN yeniden yapmak DEĞİL; yalnızca YÖNETİCİ NOTU'nda istenen düzeltmeyi uygulamaktır.

KURALLAR (çok önemli):
- Yalnızca yönetici notunun DOĞRUDAN ilgili olduğu madde(ler)i değiştir.
- Diğer tüm maddelerin kararını, puanını ve açıklama metnini KESİNLİKLE OLDUĞU GİBİ koru. Hiçbir alakasız maddeyi yeniden yargılama veya yeniden ifade etme.
- Yalnızca değiştirdiğin maddeye bağlı olarak ilgili bölüm puanını ve genel skoru tutarlı biçimde güncelle.
- Çıktıyı, mevcut raporla AYNI ZORUNLU FORMATTA (===JSON_DATA=== bloğu dahil) üret.

=== YÖNETİCİ NOTU (uygulanacak TEK değişiklik) ===
${feedback}

=== MEVCUT RAPOR (bunu temel al, minimal düzenle) ===
${evaluation.report}

=== MEVCUT YAPISAL VERİ (referans) ===
sectionScores: ${JSON.stringify(evaluation.sectionScores ?? null)}
weakCriteria: ${JSON.stringify(evaluation.weakCriteria ?? [])}

=== DEĞERLENDİRME KURALLARI (yalnızca puanlama ölçeği/format referansı — yeniden değerlendirme için DEĞİL) ===
${prompt.content}

=== TRANSKRİPT (yalnızca gerekçeyi doğrulamak için referans) ===
${evaluation.transcript}`;

  try {
    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${process.env.GOOGLE_AI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: "Sen bir satış koçusun." }] },
        contents: [{ parts: [{ text: fullPrompt }] }],
        // temperature 0 → faithful minimal edit, less collateral drift.
        generationConfig: { maxOutputTokens: 65536, temperature: 0, thinkingConfig: { thinkingBudget: 0 } },
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
