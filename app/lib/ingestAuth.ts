// Apps Script ile program arasındaki tek paylaşılan sır.
// Depoda CRON_SECRET için zaten aynı desen var; yeni mekanizma icat edilmiyor.

export function isIngestConfigured(): boolean {
  return !!process.env.MEET_INGEST_SECRET;
}

/**
 * Sır tanımsızsa "unconfigured" döner ve çağıran 500 verir.
 * Yapılandırma eksikken isteği KABUL etmek, kimlik doğrulamasız açık bir uç
 * bırakmak demek olurdu.
 */
export function checkIngestAuth(header: string | null): "ok" | "unconfigured" | "unauthorized" {
  const secret = process.env.MEET_INGEST_SECRET;
  if (!secret) return "unconfigured";
  if (!header || !header.startsWith("Bearer ")) return "unauthorized";
  return header.slice("Bearer ".length) === secret ? "ok" : "unauthorized";
}
