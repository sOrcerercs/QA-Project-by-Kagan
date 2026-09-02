const GEMINI_MODEL = "gemini-2.5-flash";

/**
 * Rubrik uygulayan çağrılar için düşünme bütçesi.
 *
 * 2.5 Flash'ta düşünme varsayılan olarak açıktır; bu projede her çağrıda
 * `thinkingBudget: 0` ile kapatılmıştı. Değerlendirme promptu ~1150 satır
 * ve çok terimli aritmetik içeriyor — muhakeme kapalıyken model yanlış
 * payda topluyor, aynı aramada tur başına farklı skor veriyor ve kendi
 * gerekçesiyle çelişen verdict üretiyor.
 *
 * Bütçe bir TAVAN, hedef değil — model ihtiyacı kadarını kullanır. Ölçüldü
 * (aynı kayıt, tekrarlı koşu):
 *    4096 → 3 koşunun 2'si DEJENERE: muhakeme görünür çıktıya taşıyor,
 *           JSON bloğu hiç gelmiyor, 4+ dk sürüp maxOutputTokens'a dayanıyor
 *    8192 → 4/4 temiz, 40-44 sn
 *   16384 → 2/2 temiz, 39-42 sn
 * Yani yükseltmek gecikme getirmiyor, düşürmek kırıyor. 16384 dejenerasyona
 * karşı bedava emniyet payı.
 *
 * Bu sayı zaman aşımını ÇÖZMEZ: prod'da tek çağrı ~52 sn ve Vercel Hobby
 * tavanı 60 sn. O sınır ancak işi Vercel dışına taşıyarak aşılır
 * (bkz. scripts/reclassify-range.ts).
 */
export const SCORING_THINKING_BUDGET = 16384;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function callGemini(
  systemPrompt: string,
  userMessage: string,
  opts: {
    maxTokens?: number;
    temperature?: number;
    timeoutMs?: number;   // set → her denemeye AbortController timeout'u + ağ hatası retry'ı
    maxAttempts?: number; // default 5 (mevcut davranış)
    maxSleepMs?: number;  // default 15000 (mevcut davranış)
    /**
     * Düşünme bütçesi. Varsayılan 0 (kapalı) — mevcut çağrıların davranışı
     * korunsun diye. Rubrik uygulayan çağrılar SCORING_THINKING_BUDGET verir.
     */
    thinkingBudget?: number;
  } = {}
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
      thinkingConfig: { thinkingBudget: opts.thinkingBudget ?? 0 },
    },
  });

  const maxAttempts = opts.maxAttempts ?? 5;
  const maxSleepMs = opts.maxSleepMs ?? Infinity;

  let response: Response | undefined;
  let lastNetErr: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const ac = opts.timeoutMs != null ? new AbortController() : undefined;
    const timer = ac ? setTimeout(() => ac.abort(), opts.timeoutMs) : undefined;
    try {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        signal: ac?.signal,
      });
    } catch (e) {
      if (timer) clearTimeout(timer);
      // Mevcut davranışı koru: timeoutMs verilmediyse ağ hatası propagate olsun.
      if (opts.timeoutMs == null) throw e;
      lastNetErr = e;
      response = undefined;
      if (attempt < maxAttempts - 1) { await sleep(Math.min(3000, maxSleepMs)); continue; }
      break;
    }
    if (timer) clearTimeout(timer);
    if (response.ok) break;
    if (response.status === 429 && attempt < maxAttempts - 1) {
      const retryAfter = response.headers.get("retry-after");
      const wait = retryAfter ? (parseInt(retryAfter, 10) + 3) * 1000 : 15000;
      await sleep(Math.min(wait, maxSleepMs));
      continue;
    }
    break;
  }

  if (!response) {
    throw new Error(`Google AI API isteği başarısız: ${lastNetErr instanceof Error ? lastNetErr.message : "ağ/timeout hatası"}`);
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
