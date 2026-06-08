// app/lib/callTypeDetector.ts
//
// Classifies a sales call as FIRST_CALL (profiling — rep is still gathering
// info and *requesting* photos, no solution presented yet) or SECOND_CALL
// (rep is presenting the solution: price, package, technique, payment).
//
// Why this is shaped the way it is: photos are mentioned in BOTH call types —
// a second call routinely references already-received photos and sends the
// offer over WhatsApp. So "the word photo appears" is NOT evidence of a first
// call. The reliable, asymmetric signal is whether a SOLUTION is being
// presented (price/package/technique). If it is, it's a SECOND_CALL even when
// photos are mentioned. Photos only point to FIRST_CALL when the rep is
// explicitly *asking* for them and no solution is on the table.

// Rep is presenting the offer/plan → SECOND_CALL. Includes price/payment,
// because quoting a price never happens on a first (profiling) call.
const SOLUTION_KEYWORDS = [
  // technique / medical plan
  "fue", "dhi", "graft", "greft", "donor", "donör", "sapphire",
  "tedavi planı", "treatment plan", "teknik", "technique", "ameliyat",
  "seans", "seansımız", "operasyon", "operation",
  // package / logistics (part of the offer)
  "paket", "package", "otel", "hotel", "transfer", "konaklama", "accommodation",
  // price / payment (strong second-call signal)
  "euro", "€", "fiyat", "price", "dolar", "$", "indirim", "discount",
  "ödeme", "payment", "deposit", "kapora", "rezervasyon", "reservation",
];

// Rep is REQUESTING photos (hasn't seen them yet) → FIRST_CALL.
// Deliberately excludes bare "photo"/"whatsapp"/"resim": those appear in
// second calls too. Only request-shaped phrases count here.
const PHOTO_REQUEST_KEYWORDS = [
  "send me", "send us", "send your", "send the photo", "send a photo",
  "photos of your head", "pictures of your head", "four angles", "from the top",
  "gönderir misiniz", "gönderir misin", "gönderebilir misiniz", "gönderebilir misin",
  "atabilir misiniz", "atar mısın", "atar mısınız",
  "fotoğraflarınızı", "fotoğrafınızı", "fotoğraflarını gönder", "resim atar",
  "dört açı", "dört açıdan", "fotoğraf çek", "saçınızın foto",
];

const GEMINI_MODEL = "gemini-2.5-flash";
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CLASSIFY_PROMPT = `Sen bir satış çağrısı sınıflandırıcısısın. Bir saç ekimi kliniğinin satış görüşmesini sınıflandır.

SECOND_CALL: Temsilci ÇÖZÜM sunuyor — fiyat, paket, ödeme, greft sayısı, teknik (FUE/DHI), otel/transfer gibi. Fotoğraflar zaten alınmış olabilir ve onlara atıf yapılır.
FIRST_CALL: Temsilci henüz fotoğraf GÖRMEDEN müşteriyi profilliyor ve fotoğraf İSTİYOR; fiyat/paket/çözüm SUNULMUYOR.

ÖNEMLİ KURAL: Görüşmede fiyat, paket veya teknik AÇIKLANIYORSA, fotoğraftan bahsedilse bile bu SECOND_CALL'dur. Emin değilsen SECOND_CALL yaz.

YALNIZCA şunu yaz: FIRST_CALL veya SECOND_CALL`;

/**
 * Stage 1 only — synchronous, no API cost. Used by the admin bulk scan too.
 *
 * Precedence (this ordering is the fix for second-calls being mislabeled
 * first-calls): a presented solution wins over any photo mention.
 *   1. solution/price present            → SECOND_CALL
 *   2. photo *request* present, no soln  → FIRST_CALL
 *   3. neither                           → null (caller may escalate to AI)
 */
export function keywordDetectCallType(transcript: string): "FIRST_CALL" | "SECOND_CALL" | null {
  const lower = transcript.toLowerCase();
  const hasSolution = SOLUTION_KEYWORDS.some((k) => lower.includes(k));
  if (hasSolution) return "SECOND_CALL";

  const hasPhotoRequest = PHOTO_REQUEST_KEYWORDS.some((k) => lower.includes(k));
  if (hasPhotoRequest) return "FIRST_CALL";

  return null; // ambiguous — caller may escalate to AI
}

/** Full two-stage detection. Falls back to SECOND_CALL if AI fails or is unsure. */
export async function detectCallType(
  transcript: string
): Promise<"FIRST_CALL" | "SECOND_CALL"> {
  // Stage 1: keyword scan over the full transcript
  const keyword = keywordDetectCallType(transcript);
  if (keyword !== null) return keyword;

  // Stage 2: AI classifier (no decisive keyword found anywhere)
  const apiKey = process.env.GOOGLE_AI_API_KEY;
  if (!apiKey) return "SECOND_CALL";

  try {
    const res = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: CLASSIFY_PROMPT }] },
        // Wider window: in a second call the solution is presented after the
        // greeting, so the first ~1500 chars alone can look like a first call.
        contents: [{ parts: [{ text: transcript.slice(0, 6000) }] }],
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
    return "SECOND_CALL"; // anything else (incl. unsure) → safe default
  } catch {
    return "SECOND_CALL";
  }
}
