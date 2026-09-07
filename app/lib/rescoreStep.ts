/**
 * Yeniden puanlama kuyruğunun SAF mantığı — zaman bütçesi ve yanıt
 * sınıflandırması. Bu dosya bilinçli olarak prisma/next import ETMEZ:
 * istemci (AdminPanel) de aynı sınıflandırmayı kullanıyor.
 */

/**
 * Platformun tek istek için verdiği tavan (ms). Vercel Hobby'de 60 sn.
 * Rotalardaki `maxDuration = 300` bu tavanı BÜYÜTMEZ — plan neyse o geçerli.
 * Pro'ya geçilirse DEEP_SCORE_REQUEST_CAP_MS=300000 ile genişletilir.
 */
export const DEEP_SCORE_REQUEST_CAP_MS = Number(
  process.env.DEEP_SCORE_REQUEST_CAP_MS ?? 60_000,
);

/**
 * Tavandan Gemini'ye AYRILMAYAN pay: yetki kontrolü, kaydı kapma, prompt
 * okuma, blok ayrıştırma, yazma, kalan sayımı ve HATA YOLUNUN kendisi.
 * Zaman aşımında kilidi bırakıp düzgün JSON dönmek için de bu pay şart —
 * platform süreci öldürürse `catch` HİÇ çalışmaz.
 */
export const DEEP_SCORE_RESERVE_MS = 8_000;

/**
 * Kuyruk yolunda Gemini'ye İÇ TEKRAR VERİLMEZ.
 *
 * NEDEN: callGemini'de `timeoutMs` verildiğinde abort bir AĞ HATASI sayılır
 * ve `maxAttempts` (kütüphane varsayılanı 5) kadar tekrarlanır. Yani sadece
 * timeoutMs yazmak 5 x 52 sn = 260 sn eder ve tavanı DAHA BETER aşar.
 * 60 sn tavanla ~41 sn ortalama bir işte tam boy bir deneme + tekrar
 * matematiksel olarak sığmaz; tek deneme zorunludur. Sığmayan kayıt deneme
 * hakkını tüketip tavansız yola (scripts/reclassify-range.ts) düşer.
 */
export const DEEP_SCORE_GEMINI_MAX_ATTEMPTS = 1;

/** Gemini'ye verilecek statik zaman aşımı. En az 1 sn kalır. */
export function geminiBudgetMs(
  capMs: number = DEEP_SCORE_REQUEST_CAP_MS,
  reserveMs: number = DEEP_SCORE_RESERVE_MS,
): number {
  return Math.max(1_000, capMs - reserveMs);
}

/**
 * Gemini'ye KALAN gerçek bütçe: tavandan payı VE isteğin başından beri
 * geçen süreyi düşer.
 *
 * NEDEN GEÇEN SÜRE: Gemini çağrısı isteğin ilk işi değil. Öncesinde yetki
 * doğrulama, kaydı kapma (iyimser kilit, yarışta 10 tura kadar), aktif
 * promptu okuma (~69 KB) var. Prod Supabase gecikmesi ölçüldü: 200 ms - 4 sn.
 * Statik bütçe bu ön işi saymaz ve toplamı sessizce tavanın üstüne taşır —
 * ki tavanı aşmak, düzeltmeye çalıştığımız arızanın ta kendisi.
 *
 * Taban 5 sn: ön iş payı yediyse bile çağrıyı hiç denemeden kesmek yerine
 * kısa bir şans ver; başarısız olursa kilit düzgünce bırakılır.
 */
export function remainingGeminiBudgetMs(
  elapsedMs: number,
  capMs: number = DEEP_SCORE_REQUEST_CAP_MS,
  reserveMs: number = DEEP_SCORE_RESERVE_MS,
): number {
  return Math.max(5_000, capMs - reserveMs - Math.max(0, elapsedMs));
}

/**
 * Kuyruk turunun sonucu.
 *
 * `unavailable` ile `empty` ayrımı ARIZANIN TA KENDİSİ: platform isteği
 * kestiğinde gövde JSON değildir (HTML hata sayfası), `res.json()` patlar ve
 * eski istemci `remaining ?? 0` ile SIFIR okuyup kuyruğu boş sanardı. Döngü
 * sessizce dururdu, kullanıcı başarı mesajı görürdü, oysa kayıt bir deneme
 * hakkı yakmış ve 5 dk kilitli kalmıştı.
 */
export type RescoreStep =
  | { kind: "processed" }
  | { kind: "retryable"; error: string }
  | { kind: "unavailable" }
  | { kind: "fatal"; error: string }
  | { kind: "empty" };

export function classifyRescoreResponse(status: number, payload: unknown): RescoreStep {
  // Yetki/yapılandırma hatası tekrar denemekle geçmez.
  const isFatalStatus = status === 401 || status === 403;

  if (payload === null || typeof payload !== "object" || Array.isArray(payload)) {
    // Gövde JSON değil → platform kesti (504/502) ya da proxy araya girdi.
    return isFatalStatus ? { kind: "fatal", error: `HTTP ${status}` } : { kind: "unavailable" };
  }

  const p = payload as Record<string, unknown>;
  const err = typeof p.error === "string" && p.error.length > 0 ? p.error : null;

  if (isFatalStatus) return { kind: "fatal", error: err ?? `HTTP ${status}` };
  if (p.processed === true) return { kind: "processed" };
  if (err) return { kind: "retryable", error: err };
  // Yalnızca sunucu AÇIKÇA "kalan 0" dediyse kuyruk boştur.
  if (p.remaining === 0) return { kind: "empty" };
  return { kind: "unavailable" };
}
