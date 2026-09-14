/**
 * Gemini'nin 429'u iki farklı şey anlatıyor ve ikisine aynı davranmak pahalı.
 *
 * GEÇİCİ (dakikalık hız sınırı): beklemek işe yarar, tekrar denemek doğru.
 * KALICI (aylık harcama tavanı / faturalandırma kotası): beklemek İŞE
 * YARAMAZ. 2026-09-14'te prod'da ölçüldü — `callGemini` 429'u geçici sanıp
 * 5 kez tekrar denedi, her çağrı 62 saniye sürdü ve çağıran tarafa
 * "zaman aşımı" olarak döndü. Gerçek sebep (harcama tavanı) yalnızca
 * sunucu logunda kaldı; panelde "Analiz sırasında sunucu hatası" yazdı.
 *
 * Bu dosya o ayrımı tek yerde tutuyor.
 */

/** İstemciye taşınan kararlı kod. Panel METNE değil buna bakar. */
export const QUOTA_ERROR_CODE = "quota_exhausted";

/**
 * Kalıcı kota tükenmesinin imzaları.
 *
 * Yalnızca KALICI olduğu kesin olan ifadeler listelenir; şüphede
 * kalınırsa `false` döner ve mevcut tekrar-deneme davranışı korunur.
 * Yanlış "kalıcı" demek, gerçekten geçici bir hız sınırında çalışan bir
 * yolu kırardı — yanlış "geçici" demenin bedeli yalnızca boşa geçen süre.
 */
const KALICI_IMZALAR = [
  /spend(?:ing)?\s+cap/i,                      // "monthly spending cap", "spend cap"
  /check your plan and billing details/i,      // faturalandırma kotası
];

/** 429 kalıcı mı? Kararsızsak `false` — yani "tekrar dene". */
export function isQuotaExhausted(status: number, body: string): boolean {
  if (status !== 429) return false;
  return KALICI_IMZALAR.some((d) => d.test(body));
}

/** Tekrar denemenin faydasız olduğu kota hatası. */
export class GeminiQuotaError extends Error {
  readonly code = QUOTA_ERROR_CODE;
  constructor(message: string) {
    super(message);
    this.name = "GeminiQuotaError";
  }
}

export function isGeminiQuotaError(e: unknown): e is GeminiQuotaError {
  return e instanceof GeminiQuotaError;
}
