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
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (!process.env.GOOGLE_AI_API_KEY) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { id } = await params;

  try {
    const evaluation = await prisma.evaluation.findUnique({
      where: { id },
      select: { report: true },
    });
    if (!evaluation) return NextResponse.json({ error: "Not found." }, { status: 404 });

    const prompt = `Translate the following Turkish sales call evaluation report to English.

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

    // Rules are embedded in the prompt; no separate systemInstruction needed.
    const geminiRes = await fetch(`${GEMINI_ENDPOINT}?key=${process.env.GOOGLE_AI_API_KEY}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 4000, temperature: 0.1 },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text().catch(() => "");
      console.error("Gemini translate error:", geminiRes.status, errText);
      return NextResponse.json({ error: "Translation service unavailable." }, { status: 500 });
    }

    const data = await geminiRes.json();
    const translated: string = data.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!translated) {
      console.error("Gemini translate: boş yanıt", JSON.stringify(data).slice(0, 200));
      return NextResponse.json({ error: "Translation service returned empty response." }, { status: 500 });
    }

    return NextResponse.json({ report: translated.trim() });
  } catch (error: any) {
    console.error("Translate route error:", error.message);
    return NextResponse.json({ error: "Internal server error." }, { status: 500 });
  }
}
