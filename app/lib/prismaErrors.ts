/**
 * Prisma hata sınıflandırması.
 *
 * Neden ayrı dosya: aynı kontrol üç senkron route'unda kopyalanmıştı ve
 * üçü de yanlış yere bakıyordu.
 */

/**
 * Belirli bir alanın benzersizlik kısıtı ihlali mi?
 *
 * DİKKAT — şekil sürüme bağlı. Prisma 7 + PrismaPg sürücü adaptöründe alan
 * bilgisi `meta.target`'ta DEĞİL, şurada:
 *
 *   meta.driverAdapterError.cause.constraint.fields = ["\"externalCallId\""]
 *
 * (tırnaklar dahil). Eski Prisma sürümleri `meta.target` kullanıyordu.
 * Bu yüzden tek bir yola bağlanmak yerine metanın tamamında arıyoruz —
 * şekil yine değişirse sessizce bozulmasın.
 */
export function isUniqueConstraintOn(e: unknown, field: string): boolean {
  const err = e as { code?: string; meta?: unknown; message?: string };
  if (err?.code !== "P2002") return false;
  let meta = "";
  try {
    meta = JSON.stringify(err.meta ?? "");
  } catch {
    meta = String(err.meta ?? "");
  }
  return meta.includes(field) || String(err.message ?? "").includes(field);
}

/** Senkronda sık karşılaşılan hâli: aynı çağrı paralel bir koşuda yazılmış. */
export function isDuplicateCallError(e: unknown): boolean {
  return isUniqueConstraintOn(e, "externalCallId");
}
