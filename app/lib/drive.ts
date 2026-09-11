// Google Drive REST v3 istemcisi (yalnızca sunucu tarafı).
// googleapis paketi BİLİNÇLİ olarak kurulmadı: tek bir klasör listeleme ve
// metin indirme işi için `jose` ile elle JWT üretmek yeterli, Fireflies
// GraphQL istemcisi de aynı şekilde elle yazılmıştı.

import { SignJWT, importPKCS8 } from "jose";

const NAME_SEPARATOR = "__";
/** `YYYY-MM-DDTHH-mm` — saat ayırıcısı `:` değil `-`, Drive adında karışmasın. */
const STARTED_AT_RE = /^(\d{4})-(\d{2})-(\d{2})T(\d{2})-(\d{2})$/;
/** Drive dosya/klasör ID'leri en az 10 karakter, URL-güvenli alfabe. */
const FOLDER_ID_RE = /^[A-Za-z0-9_-]{10,}$/;

export interface InboxFileName {
  startedAt: Date;
  agentEmail: string;
  meetFolderId: string;
}

/**
 * Ortak klasördeki dosya adını ayrıştırır.
 *
 * Adlandırma sözleşmesi script'in sorumluluğu; burada DOĞRULANIR ve
 * tutmazsa null döner (çağıran tarafta SKIPPED + skipReason). Sessizce
 * varsayılana düşmek yok: bozuk ad, kaybolmuş bir çağrı demektir.
 */
export function parseInboxFileName(fileName: string): InboxFileName | null {
  if (!fileName.endsWith(".txt")) return null;
  const base = fileName.slice(0, -".txt".length);

  const parts = base.split(NAME_SEPARATOR);
  if (parts.length !== 3) return null;
  const [rawDate, agentEmail, meetFolderId] = parts;

  const m = STARTED_AT_RE.exec(rawDate);
  if (!m) return null;
  if (!agentEmail.includes("@") || /\s/.test(agentEmail)) return null;
  if (!FOLDER_ID_RE.test(meetFolderId)) return null;

  const [, yyyy, mm, dd, hh, min] = m;
  // Europe/Istanbul sabit UTC+3, yaz saati uygulaması yok.
  const startedAt = new Date(`${yyyy}-${mm}-${dd}T${hh}:${min}:00.000+03:00`);
  if (Number.isNaN(startedAt.getTime())) return null;

  return { startedAt, agentEmail, meetFolderId };
}

const TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const DRIVE_FILES_ENDPOINT = "https://www.googleapis.com/drive/v3/files";
const SCOPE = "https://www.googleapis.com/auth/drive.readonly";
/** Drive tek sayfada en fazla 1000 döner; kutu büyürse sayfalanır. */
const PAGE_SIZE = 1000;

export interface DriveFile {
  id: string;
  name: string;
}

export function isDriveConfigured(): boolean {
  return !!(
    process.env.GOOGLE_DRIVE_SA_EMAIL &&
    process.env.GOOGLE_DRIVE_SA_PRIVATE_KEY &&
    process.env.GOOGLE_DRIVE_INBOX_FOLDER_ID
  );
}

/**
 * Env'den gelen özel anahtarı PEM'e çevirir.
 *
 * .env dosyaları satır sonu taşıyamadığı için anahtar `\n` kaçışlarıyla
 * yazılır; importPKCS8 gerçek satır sonu bekler. Vercel arayüzünden
 * yapıştırıldığında kaçışsız gelebiliyor — iki hâli de kabul ediyoruz.
 */
export function normalizePrivateKey(raw: string): string {
  return raw.replace(/^"|"$/g, "").replace(/\\n/g, "\n");
}

export async function getDriveAccessToken(): Promise<string> {
  const email = process.env.GOOGLE_DRIVE_SA_EMAIL;
  const key = process.env.GOOGLE_DRIVE_SA_PRIVATE_KEY;
  if (!email || !key) throw new Error("GOOGLE_DRIVE_SA_EMAIL / GOOGLE_DRIVE_SA_PRIVATE_KEY eksik.");

  const pk = await importPKCS8(normalizePrivateKey(key), "RS256");
  const now = Math.floor(Date.now() / 1000);
  const assertion = await new SignJWT({ scope: SCOPE })
    .setProtectedHeader({ alg: "RS256", typ: "JWT" })
    .setIssuer(email)
    .setAudience(TOKEN_ENDPOINT)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .sign(pk);

  const res = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion,
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Drive token hatası: ${res.status} — ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  if (!json.access_token) throw new Error("Drive token yanıtında access_token yok.");
  return json.access_token as string;
}

/**
 * Ortak klasörün TAMAMINI listeler — tarih penceresi YOK.
 *
 * Fireflies "dün"ü çekiyordu ve o güne bir daha bakmadığı için geç beliren
 * transkriptler kalıcı olarak kaçıyordu. Kutu modelinde pencereye gerek yok:
 * listeleme sadece metadata olduğu için ucuz, bilinmeyenin metni indirilir.
 */
export async function listInboxFiles(): Promise<DriveFile[]> {
  const folderId = process.env.GOOGLE_DRIVE_INBOX_FOLDER_ID;
  if (!folderId) throw new Error("GOOGLE_DRIVE_INBOX_FOLDER_ID eksik.");
  const token = await getDriveAccessToken();

  const out: DriveFile[] = [];
  let pageToken: string | undefined;
  do {
    const params = new URLSearchParams({
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name)",
      pageSize: String(PAGE_SIZE),
    });
    if (pageToken) params.set("pageToken", pageToken);

    const res = await fetch(`${DRIVE_FILES_ENDPOINT}?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      throw new Error(`Drive listeleme hatası: ${res.status} — ${txt.slice(0, 200)}`);
    }
    const json = await res.json();
    for (const f of json.files ?? []) out.push({ id: f.id, name: f.name });
    pageToken = json.nextPageToken;
  } while (pageToken);

  return out;
}

export async function downloadDriveText(fileId: string): Promise<string> {
  const token = await getDriveAccessToken();
  const res = await fetch(`${DRIVE_FILES_ENDPOINT}/${fileId}?alt=media`, {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`Drive indirme hatası (${fileId}): ${res.status} — ${txt.slice(0, 200)}`);
  }
  return res.text();
}
