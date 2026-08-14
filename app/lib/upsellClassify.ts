// Değerlendirme raporundaki "Upsell Durumu" satırını Stem Cell ve Premium
// tanıtımı olarak yapısallaştırmak için saf yardımcılar. Burada ne DB ne AI
// erişimi vardır; Gemini çağrısı upsellClassifier.ts'tedir.

export type UpsellStatus = "SUNULDU" | "SUNULMADI" | "NA" | "BILINMIYOR";

export interface UpsellVerdict {
  i: number;
  stemCell: UpsellStatus;
  premium: UpsellStatus;
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

export function buildBatchPrompt(items: UpsellBatchItem[]): string {
  const lines = items.map((it) => `${it.i}) ${it.line}`).join("\n");
  return `Aşağıda numaralandırılmış "Upsell Durumu" satırları var. Her satır için Stem Cell ve Premium paketin danışman tarafından müşteriye SUNULUP sunulmadığını belirle.\n\n${lines}`;
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
    out.push({ i, stemCell, premium });
  }

  if (new Set(out.map((v) => v.i)).size !== expected) return null;
  return out;
}
