// Değerlendirmeler sayfasındaki çağrı tipi filtresi için param doğrulama.
// Yalnızca 1. Çağrı / 2. Çağrı filtrelenir; diğer her şey (boş, geçersiz,
// FOLLOW_UP/GENERAL dahil) filtre uygulanmadığı ("Tümü") anlamına gelir → undefined.
// Prisma enum değerleri string birebir olduğundan dönen değer doğrudan
// whereBase.callType'a atanabilir.
export type CallTypeFilter = "FIRST_CALL" | "SECOND_CALL";

export function parseCallTypeFilter(
  value: string | null | undefined
): CallTypeFilter | undefined {
  return value === "FIRST_CALL" || value === "SECOND_CALL" ? value : undefined;
}
