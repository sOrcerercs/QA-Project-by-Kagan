import { firefliesExternalCallId } from "./firefliesLink";

// Entegrasyondan istenen ham Fireflies id'leri ile DB'de bulunan externalCallId'leri
// (ff_<id> formatında) karşılaştırıp her istenen id için varlık boolean'ı üretir.
// Anahtar, istenen id'nin girildiği hâlidir (ham veya ff_ önekli).
export function buildExistsResult(
  requestedIds: string[],
  foundExternalCallIds: string[]
): Record<string, boolean> {
  const foundSet = new Set(foundExternalCallIds);
  const result: Record<string, boolean> = {};
  for (const rawId of requestedIds) {
    const key = firefliesExternalCallId(rawId);
    if (!key) continue; // boş/geçersiz id atlanır
    result[rawId] = foundSet.has(key);
  }
  return result;
}
