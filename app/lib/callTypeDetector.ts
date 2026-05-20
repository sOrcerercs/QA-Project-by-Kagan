// app/lib/callTypeDetector.ts
const PHOTO_KEYWORDS = [
  "photo", "fotoğraf", "resim", "picture", "whatsapp",
  "send me", "gönderir misiniz", "gönderir misin", "atabilir misiniz",
  "fotoğraflarınızı", "fotoğrafınızı",
];

const TREATMENT_KEYWORDS = [
  "fue", "dhi", "graft", "donor", "donör", "sapphire",
  "paket", "package", "otel", "hotel", "transfer",
  "tedavi planı", "treatment plan", "teknik", "technique", "ameliyat",
  "seans", "seansımız", "operasyon",
];

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CLASSIFY_PROMPT = `Sen bir satış çağrısı sınıflandırıcısısın.

KURAL:
- Temsilci müşteriden FOTOĞRAF istiyorsa → FIRST_CALL
  (henüz fotoğraf görmeden, müşteriyi profilliyor)
- Temsilci tedavi planı, teknik (FUE/DHI), paket veya fiyat açıklıyorsa → SECOND_CALL
  (fotoğrafları gördükten sonra çözüm sunuyor)

YALNIZCA şunu yaz: FIRST_CALL veya SECOND_CALL`;

/** Stage 1 only — synchronous, no API cost. Used by the admin bulk scan. */
export function keywordDetectCallType(transcript: string): "FIRST_CALL" | "SECOND_CALL" | null {
  const lower = transcript.toLowerCase();
  const hasPhoto = PHOTO_KEYWORDS.some((k) => lower.includes(k));
  const hasTreatment = TREATMENT_KEYWORDS.some((k) => lower.includes(k));

  if (hasPhoto && !hasTreatment) return "FIRST_CALL";
  if (hasTreatment && !hasPhoto) return "SECOND_CALL";
  return null; // ambiguous — caller may escalate to AI
}

/** Full two-stage detection. Falls back to SECOND_CALL if AI fails. */
export async function detectCallType(
  transcript: string
): Promise<"FIRST_CALL" | "SECOND_CALL"> {
  // Stage 1: keyword scan
  const keyword = keywordDetectCallType(transcript);
  if (keyword !== null) return keyword;

  // Stage 2: AI classifier (ambiguous — both or neither keyword found)
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return "SECOND_CALL";

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CLASSIFY_PROMPT }] },
        contents: [{ parts: [{ text: transcript.slice(0, 1500) }] }],
        generationConfig: {
          maxOutputTokens: 10,
          temperature: 0,
          thinkingConfig: { thinkingBudget: 0 },
        },
      }),
    });

    if (!res.ok) return "SECOND_CALL";

    const data = await res.json();
    const text: string = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? "";
    if (text === "FIRST_CALL") return "FIRST_CALL";
    return "SECOND_CALL";
  } catch {
    return "SECOND_CALL";
  }
}
