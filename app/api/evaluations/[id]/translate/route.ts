import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  if (!process.env.GROQ_API_KEY) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const { id } = await params;

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

  const groqRes = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
    },
    body: JSON.stringify({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      max_tokens: 4000,
      temperature: 0.1,
    }),
  });

  if (!groqRes.ok) {
    return NextResponse.json({ error: "Translation service unavailable." }, { status: 500 });
  }

  const data = await groqRes.json();
  const translated: string = data.choices[0].message.content;

  return NextResponse.json({ report: translated });
}
