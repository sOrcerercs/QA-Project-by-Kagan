// Analiz (transcript sohbeti) bölümünü görüntüleme yetkisi tek bir hesaba aittir.
// MANAGER'lar ve diğer ADMIN'ler dahil hiç kimse erişemez. Projedeki e-posta
// anahtarlı yetki desenini (okrPermissions.ts, qaPermissions.ts) izler.
export const ANALYSIS_VIEWER_EMAIL = "admin@estenove.com";

export function canViewAnalysis(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === ANALYSIS_VIEWER_EMAIL;
}
