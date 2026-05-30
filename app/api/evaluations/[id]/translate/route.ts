import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

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
      select: { report: true, weakCriteria: true },
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

    return NextResponse.json({ report: translated, weakCriteria: translatedWeakCriteria });
  } catch (error: any) {
    console.error("Translate route error:", error.message);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
