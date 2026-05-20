const GEMINI_MODEL = "gemini-2.5-flash";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callGemini(
  systemPrompt: string,
  userMessage: string,
  opts: { maxTokens?: number; temperature?: number } = {}
): Promise<string> {
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) throw new Error("GOOGLE_AI_API_KEY tanımlı değil.");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents: [{ parts: [{ text: userMessage }] }],
    generationConfig: {
      maxOutputTokens: opts.maxTokens ?? 65536,
      temperature: opts.temperature ?? 0.3,
      thinkingConfig: { thinkingBudget: 0 },
    },
  });

  let response!: Response;
  for (let attempt = 0; attempt < 5; attempt++) {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
    });
    if (response.ok) break;
    if (response.status === 429 && attempt < 4) {
      const retryAfter = response.headers.get("retry-after");
      const wait = retryAfter ? (parseInt(retryAfter, 10) + 3) * 1000 : 15000;
      await sleep(wait);
      continue;
    }
    break;
  }

  if (!response.ok) {
    const errText = await response.text().catch(() => "");
    throw new Error(`Google AI API hatası: ${response.status} — ${errText.slice(0, 200)}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) throw new Error("Google AI yanıtı boş geldi.");
  return text;
}
