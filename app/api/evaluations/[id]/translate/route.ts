import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { collectTranslatable, applyTranslations } from "@/app/lib/reportDataI18n";

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

async function geminiTranslate(prompt: string): Promise<string> {
  const res = await fetch(`${GEMINI_ENDPOINT}?key=${process.env.GOOGLE_AI_API_KEY}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: { maxOutputTokens: 16000, temperature: 0.1, thinkingConfig: { thinkingBudget: 0 } },
    }),
  });
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const data = await res.json();
  const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Empty response");
  return text.trim();
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { id } = await params;

  try {
    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      select: { report: true, weakCriteria: true, reportData: true },
    });
    if (!evaluation) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const reportPrompt = `Translate the following Turkish sales call evaluation report to English.

Rules:
1. Keep all emoji at the start of lines (📊, 📝, ✅, 💰, 💭, 🛑, 🚨, 📈, 🔍, 💡, 🎯, etc.) exactly as-is.
2. Keep all bullet points (•, -) unchanged.
3. Translate these structural labels with exact mapping:
   - "Temsilci:" → "Consultant:"
   - "Müşteri:" → "Customer:"
   - Lines starting with "Görüşme" → start with "Call"
   - "Genel Skor:" → "Overall Score:"
   - "Kanıt:" (anywhere in line) → "Evidence:"
   - "Olması Gereken:" (anywhere in line) → "Expected:"
4. Keep all numbers, percentages, names, durations, and scores unchanged.
5. Maintain the exact same line structure — one line in equals one line out.
6. Output only the translated report with no preamble or explanation.

Report:
${evaluation.report}`;

    // Translate report and weakCriteria in parallel
    const tasks: Promise<any>[] = [geminiTranslate(reportPrompt)];

    const rawCriteria = evaluation.weakCriteria as Array<{ id: string; label: string; score: number; coachingNote: string }> | null;
    const hasCriteria = Array.isArray(rawCriteria) && rawCriteria.length > 0;

    if (hasCriteria) {
      const criteriaPrompt = `Translate each Turkish "label" and "coachingNote" to English. Keep "id" and "score" exactly as-is. Return ONLY valid JSON array, no explanation.

Input:
${JSON.stringify(rawCriteria)}

Output format (same structure, translated label and coachingNote only):`;
      tasks.push(geminiTranslate(criteriaPrompt));
    }

    // reportData: yalnızca modelin yazdığı serbest metinler düz bir dizi olarak
    // gider ve aynı uzunlukta geri gelir. Kanıt alıntıları, highlight'lar,
    // id'ler ve puanlar çeviriye hiç girmez (bkz. reportDataI18n.ts).
    const reportDataTexts = collectTranslatable(evaluation.reportData);
    const hasReportData = reportDataTexts.length > 0;
    const reportDataTaskIndex = hasCriteria ? 2 : 1;

    if (hasReportData) {
      const textsPrompt = `Translate each string in the following JSON array from Turkish to English.

Rules:
1. Return ONLY a valid JSON array of strings — no explanation, no keys, no markdown fence.
2. The output array MUST have exactly ${reportDataTexts.length} items, in the same order as the input.
3. Translate each item independently. Never merge, split, reorder or drop items.
4. Keep numbers, times, prices, proper nouns and product names (Estenove, NoveCare, Sapphire FUE, DHI, WhatsApp) unchanged.
5. If an item is already English, return it unchanged.

Input:
${JSON.stringify(reportDataTexts)}`;
      tasks.push(geminiTranslate(textsPrompt));
    }

    const results = await Promise.allSettled(tasks);

    const reportResult = results[0];
    if (reportResult.status === "rejected") {
      console.error("Gemini translate report error:", reportResult.reason);
      return NextResponse.json({ error: "Translation service unavailable." }, { status: 500 });
    }
    const translated = reportResult.value as string;

    let translatedWeakCriteria: typeof rawCriteria = null;
    if (hasCriteria && results[1]?.status === "fulfilled") {
      try {
        const raw = results[1].value as string;
        const jsonMatch = raw.match(/\[[\s\S]*\]/);
        if (jsonMatch) translatedWeakCriteria = JSON.parse(jsonMatch[0]);
      } catch {
        // fallback to original if parse fails
        translatedWeakCriteria = rawCriteria;
      }
    }

    let translatedReportData: unknown = null;
    if (hasReportData) {
      const task = results[reportDataTaskIndex];
      if (task?.status === "fulfilled") {
        try {
          const raw = task.value as string;
          const jsonMatch = raw.match(/\[[\s\S]*\]/);
          if (jsonMatch) {
            // Uzunluk tutmazsa applyTranslations orijinali döndürür — kart
            // yarım çevrilmiş değil, tamamen Türkçe görünür.
            translatedReportData = applyTranslations(evaluation.reportData, JSON.parse(jsonMatch[0]));
          }
        } catch (err) {
          console.warn("[translate] reportData translation parse failed — falling back to Turkish:", err);
        }
      } else if (task?.status === "rejected") {
        console.warn("[translate] reportData translation failed:", task.reason);
      }
    }

    return NextResponse.json({
      report: translated,
      weakCriteria: translatedWeakCriteria,
      reportData: translatedReportData,
    });
  } catch (error: any) {
    console.error("Translate route error:", error.message);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
