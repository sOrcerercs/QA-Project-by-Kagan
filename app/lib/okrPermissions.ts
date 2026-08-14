// OKR panelini görüntüleme yetkisi tek bir hesaba aittir. MANAGER'lar ve diğer
// ADMIN'ler dahil hiç kimse erişemez. Projedeki e-posta anahtarlı yetki desenini
// (qaPermissions.ts, evaluationRules.ts) izler.
export const OKR_VIEWER_EMAIL = "admin@estenove.com";

export function canViewOkr(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === OKR_VIEWER_EMAIL;
}
