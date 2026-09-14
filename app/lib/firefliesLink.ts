// Entegrasyondan gelen ham Fireflies transcript ID'sini (ör. "01KY1V3...") veya
// zaten "ff_" önekli hâlini, DB'deki Evaluation.externalCallId anahtarına çevirir.
// Fireflies senkronu bu alanı "ff_" + transcript.id olarak yazıyordu
// (alma yolu 2026-09-11'de kaldırıldı; 1868 geçmiş kayıt bu biçimde duruyor).
// Boş girdi (veya sadece "ff_") -> null.
export function firefliesExternalCallId(rawId: string): string | null {
  const clean = (rawId ?? "").trim().replace(/^ff_/, "").trim();
  if (!clean) return null;
  return `ff_${clean}`;
}
