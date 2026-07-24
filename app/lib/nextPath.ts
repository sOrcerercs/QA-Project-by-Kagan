// Login sonrası yönlendirilecek "next" parametresini güvenli hâle getirir.
// Açık yönlendirme (open-redirect) koruması: yalnızca site-içi relative path kabul edilir
// ("/" ile başlar, "//" ile başlamaz). Aksi her durumda "/" döner.
export function safeNextPath(raw: string | null | undefined): string {
  const s = (raw ?? "").trim();
  if (!s.startsWith("/") || s.startsWith("//")) return "/";
  return s;
}
