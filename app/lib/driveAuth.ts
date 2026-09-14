/**
 * Drive'a salt okunur erişim için OAuth refresh token katmanı.
 *
 * NEDEN SERVICE ACCOUNT DEĞİL: organizasyon politikası
 * `iam.disableServiceAccountKeyCreation` anahtar üretimini reddediyor
 * (bkz. itme modeline geçiş kararı). Geriye tek bir hesabın refresh
 * token'ı kalıyor — kayıtların paylaşıldığı hesap.
 *
 * BEDELİ, AÇIKÇA: token o hesaba bağlı. Hesap kapanır, şifre değişir ya da
 * erişim iptal edilirse kayıt OYNATILAMAZ. Çağrı kaybı olmaz; alma hattı
 * bu katmana hiç dokunmuyor, yalnızca oynatma bozulur.
 */

const TOKEN_UCU = "https://oauth2.googleapis.com/token";

/**
 * Token'ı bitiminden bu kadar önce tazele.
 *
 * Kayıtlar 90-429 MB; tarayıcı bunu parça parça, dakikalar boyunca çekiyor.
 * Tam bitim anında tazelemek, uzun bir indirmenin ortasında 401 demek.
 */
export const ACCESS_TOKEN_MARGIN_MS = 5 * 60 * 1000;

export function isAccessTokenFresh(
  expiresAt: number | null,
  now: number,
  marginMs = ACCESS_TOKEN_MARGIN_MS,
): boolean {
  if (expiresAt === null) return false;
  return expiresAt - now >= marginMs;
}

export function isDriveConfigured(): boolean {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
    process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN,
  );
}

// Süreç içi önbellek. Access token ~1 saat yaşıyor; her istekte yeniden
// almak Google'a gereksiz tur ve gecikme demek.
let onbellekToken: string | null = null;
let onbellekBitis: number | null = null;

/** Geçerli bir access token döndürür; gerekirse refresh token ile tazeler. */
export async function getDriveAccessToken(): Promise<string> {
  if (onbellekToken && isAccessTokenFresh(onbellekBitis, Date.now())) {
    return onbellekToken;
  }
  if (!isDriveConfigured()) {
    throw new Error("Drive erişimi yapılandırılmamış (GOOGLE_DRIVE_* değişkenleri eksik).");
  }

  const govde = new URLSearchParams({
    client_id: process.env.GOOGLE_DRIVE_CLIENT_ID!,
    client_secret: process.env.GOOGLE_DRIVE_CLIENT_SECRET!,
    refresh_token: process.env.GOOGLE_DRIVE_REFRESH_TOKEN!,
    grant_type: "refresh_token",
  });

  const res = await fetch(TOKEN_UCU, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: govde,
  });

  if (!res.ok) {
    const metin = await res.text().catch(() => "");
    // Önbelleği temizle: ölü bir token'ı saklamak, sonraki isteğin de
    // sessizce yanlış kimlikle gitmesi demek.
    onbellekToken = null;
    onbellekBitis = null;
    throw new Error(`Drive token tazelenemedi: ${res.status} — ${metin.slice(0, 200)}`);
  }

  const data = await res.json();
  if (!data.access_token) throw new Error("Drive token yanıtı access_token içermiyor.");

  onbellekToken = data.access_token as string;
  // expires_in saniye cinsinden; yoksa temkinli bir varsayılan.
  onbellekBitis = Date.now() + (Number(data.expires_in) || 3600) * 1000;
  return onbellekToken;
}
