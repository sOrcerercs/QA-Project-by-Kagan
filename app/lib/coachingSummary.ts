// Gelişim Özeti (coaching summary) için saf yardımcılar.

// Model çıktısından { summary, actionItems } çıkarır. Kod fence'lerini ve
// JSON çevresindeki metni tolere eder (ilk '{' ... son '}'). summary zorunlu;
// actionItems yoksa veya dizi değilse boş dizi döner (yumuşak). Bu, tek bir
// biçimsiz üretimin sert 500 yerine bayat-fallback'e düşmesini sağlar.
export function extractSummaryJson(raw: string): { summary: string; actionItems: string[] } {
  if (typeof raw !== "string" || raw.trim() === "") throw new Error("Boş model yanıtı");
  const text = raw.replace(/```json/gi, "").replace(/```/g, "").trim();
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("Yanıtta JSON bulunamadı");
  let parsed: unknown;
  try {
    parsed = JSON.parse(text.slice(start, end + 1));
  } catch {
    throw new Error("JSON ayrıştırılamadı");
  }
  const obj = parsed as { summary?: unknown; actionItems?: unknown };
  const summary = typeof obj.summary === "string" ? obj.summary.trim() : "";
  if (!summary) throw new Error("summary eksik veya boş");
  const actionItems = Array.isArray(obj.actionItems)
    ? obj.actionItems.filter((x): x is string => typeof x === "string" && x.trim() !== "").map((x) => x.trim())
    : [];
  return { summary, actionItems };
}

// SWR tazelik kararı: summary dolu VE üretim anındaki evalCount güncel pencere
// sayısına eşitse taze. evalCount'tan türetilir; ayrı bir invalidation gerekmez.
export function isCoachingSummaryFresh(
  cached: { summary: string | null; evalCount: number } | null,
  currentCount: number
): boolean {
  return !!cached && cached.summary != null && cached.summary !== "" && cached.evalCount === currentCount;
}
