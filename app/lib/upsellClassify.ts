// Değerlendirme raporundaki "Upsell Durumu" satırını Stem Cell ve Premium
// tanıtımı olarak yapısallaştırmak için saf yardımcılar. Burada ne DB ne AI
// erişimi vardır; Gemini çağrısı upsellClassifier.ts'tedir.

export type UpsellStatus = "SUNULDU" | "SUNULMADI" | "NA" | "BILINMIYOR";

/** Sınıflandırıcıya sorulan evet/hayır sorularının cevabı. */
export type YesNo = "EVET" | "HAYIR";

export interface UpsellVerdict {
  i: number;
  stemCell: UpsellStatus;
  premium: UpsellStatus;
  /**
   * Ek alanlar eksik ya da sözlük dışı gelirse undefined kalır — batch
   * reddedilmez. Kurallar (bkz. okr.ts effectiveStatus) yalnızca "EVET" ile
   * tetiklendiği için eksik veri metriği gevşetmez, olduğu kadar sıkı bırakır.
   *
   * customerChosePremium artık hiçbir kural tarafından okunmuyor: 2026-08-15'te
   * Stem Cell muafiyetinin koşulu "müşteri Premium'u seçti"den "danışman
   * Premium'u anlattı"ya çevrildi. Alan, tanıma geri dönmek gerekirse diye
   * toplanmaya devam ediyor.
   */
  customerChosePremium?: YesNo;
  /** Müşteri bütçesinin yetmediğini / o parayı veremeyeceğini belirtti mi? */
  budgetConstraint?: YesNo;
  /**
   * Müşteri belirli bir paketi (Essential / temel paket ya da bir başkasını)
   * tercih ettiğini NET olarak beyan etti mi? Dikkat: "yalnızca temel paket
   * anlatıldı" bu değildir — o danışmanın kapsamı, müşterinin tercihi değil.
   */
  customerFixedChoice?: YesNo;
}

export interface UpsellBatchItem {
  i: number;
  line: string;
}

/**
 * Raporun "Upsell Durumu" satırını bulur, markdown süslerini temizler.
 * Prod'daki biçim: `* **Upsell Durumu:** BAŞARILI. Stem Cell ...`
 */
export function extractUpsellLine(report: string | null | undefined): string | null {
  if (!report) return null;
  for (const rawLine of report.split("\n")) {
    const match = /Upsell\s*Durumu[\s:*]*(.+)$/i.exec(rawLine);
    if (!match) continue;
    const cleaned = match[1].replace(/\*\*/g, "").trim();
    if (cleaned.length > 0) return cleaned;
  }
  return null;
}

export function normalizeStatus(raw: string): UpsellStatus | null {
  const v = (raw ?? "").trim().toUpperCase().replace(/[-_\s/]/g, "");
  if (v === "SUNULDU") return "SUNULDU";
  if (v === "SUNULMADI") return "SUNULMADI";
  if (v === "NA") return "NA";
  if (v === "BILINMIYOR") return "BILINMIYOR";
  return null;
}

/** Türkçe "hayır"ın şapkasız/İ'siz yazımları da kabul edilir. */
export function normalizeYesNo(raw: string): YesNo | null {
  const v = (raw ?? "").trim().toLocaleUpperCase("tr").replace(/[-_\s]/g, "");
  if (v === "EVET") return "EVET";
  // "hayır" → HAYIR, "hayir" → HAYİR (tr locale i→İ). İkisi de kabul.
  if (v === "HAYIR" || v === "HAYİR") return "HAYIR";
  return null;
}

// Paketin satırda anılıp anılmadığı. Advanced paket Stem Cell içerdiği için
// onun adı da Stem Cell bahsi sayılır (bkz. upsellClassifier.ts prompt kuralı).
const MENTION: Record<"stemCell" | "premium", RegExp> = {
  stemCell: /stem\s*cell|kök\s*hücre|kok\s*hucre|advanced/i,
  premium: /premium/i,
};

export function mentionsPackage(line: string, field: "stemCell" | "premium"): boolean {
  return MENTION[field].test(line ?? "");
}

/**
 * Sessizlik koruması: rapor yazarı bir paketten hiç söz etmediyse o kalem
 * BILINMIYOR olur, SUNULMADI değil.
 *
 * Neden: sınıflandırıcıya "bahsi geçmeyen kalem SUNULMADI'dır" dendiğinde
 * yazarın sessizliği danışmanın cezasına dönüşüyordu. 2026-08-16 ölçümü:
 * eksik listesindeki 543 kaydın 334'ünde (%61) "premium" kelimesi satırda hiç
 * geçmiyordu; Stem Cell'de aynı durum 224 kaydın yalnızca 12'sindeydi. Bu tek
 * asimetri, Premium oranının Stem Cell'in çok altında kalmasını açıklıyordu.
 *
 * Sessizlik "sunulmadı" değil "bilmiyoruz" demektir → BILINMIYOR paydadan
 * tamamen düşer (NA'nın aksine pozitif de sayılmaz, bkz. okr.ts upsellRate).
 * Koruma yalnızca SUNULMADI'ya uygulanır; SUNULDU/NA modelin olumlu kararıdır.
 */
export function applySilenceGuard<T extends UpsellVerdict>(verdict: T, line: string): T {
  const fix = (field: "stemCell" | "premium"): UpsellStatus =>
    verdict[field] === "SUNULMADI" && !mentionsPackage(line, field)
      ? "BILINMIYOR"
      : verdict[field];
  return { ...verdict, stemCell: fix("stemCell"), premium: fix("premium") };
}

export function buildBatchPrompt(items: UpsellBatchItem[]): string {
  const lines = items.map((it) => `${it.i}) ${it.line}`).join("\n");
  return `Aşağıda numaralandırılmış "Upsell Durumu" satırları var. Her satır için Stem Cell ve Premium paketin danışman tarafından müşteriye SUNULUP sunulmadığını, müşterinin Premium paketi tercih ettiğini beyan edip etmediğini, müşterinin bütçe kısıtı belirtip belirtmediğini ve müşterinin belirli bir paketi net olarak tercih ettiğini beyan edip etmediğini belirle.\n\n${lines}`;
}

/**
 * Modelin yanıtını doğrular. Uzunluk, indeks tekilliği veya sözlük dışı bir
 * değer hatalıysa TÜM batch reddedilir (null) — kısmi/bozuk veri kaydedilmez.
 */
export function parseBatchResponse(raw: string, expected: number): UpsellVerdict[] | null {
  const match = /\[[\s\S]*\]/.exec(raw ?? "");
  if (!match) return null;

  let parsed: unknown;
  try {
    parsed = JSON.parse(match[0]);
  } catch {
    return null;
  }
  if (!Array.isArray(parsed) || parsed.length !== expected) return null;

  const out: UpsellVerdict[] = [];
  for (const item of parsed) {
    const rec = item as Record<string, unknown>;
    const i = rec?.i;
    const stemCell = normalizeStatus(String(rec?.stemCell ?? ""));
    const premium = normalizeStatus(String(rec?.premium ?? ""));
    if (typeof i !== "number" || !stemCell || !premium) return null;
    const choice = normalizeYesNo(String(rec?.customerChosePremium ?? ""));
    const budget = normalizeYesNo(String(rec?.budgetConstraint ?? ""));
    const fixedChoice = normalizeYesNo(String(rec?.customerFixedChoice ?? ""));
    out.push({
      i, stemCell, premium,
      ...(choice ? { customerChosePremium: choice } : {}),
      ...(budget ? { budgetConstraint: budget } : {}),
      ...(fixedChoice ? { customerFixedChoice: fixedChoice } : {}),
    });
  }

  // buildBatchPrompt her zaman 1..N ile numaralandırır, bu yüzden dönen indekslerin
  // tam olarak {1, 2, ..., expected} kümesi olması gerekir. Aksi halde model yanlış
  // sayıları döndü ve verdiktler yanlış evaluasyonlara eşlenirdi — susturucu veri hatası.
  const expectedIndices = new Set([...Array(expected)].map((_, i) => i + 1));
  const actualIndices = new Set(out.map((v) => v.i));
  if (actualIndices.size !== expected || ![...expectedIndices].every((i) => actualIndices.has(i))) {
    return null;
  }

  return out;
}
