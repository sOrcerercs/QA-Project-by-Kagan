// Entegrasyondan gelen ham Fireflies transcript ID'sini (ör. "01KY1V3...") veya
// zaten "ff_" önekli hâlini, DB'deki Evaluation.externalCallId anahtarına çevirir.
// Fireflies senkronu bu alanı "ff_" + transcript.id olarak yazar
// (app/api/calls/sync-fireflies/route.ts). Boş girdi (veya sadece "ff_") -> null.
export function firefliesExternalCallId(rawId: string): string | null {
  const clean = (rawId ?? "").trim().replace(/^ff_/, "").trim();
  if (!clean) return null;
  return `ff_${clean}`;
}
