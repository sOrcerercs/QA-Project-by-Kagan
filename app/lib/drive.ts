// Google Drive REST v3 istemcisi (yalnızca sunucu tarafı).
// googleapis paketi BİLİNÇLİ olarak kurulmadı: tek bir klasör listeleme ve
// metin indirme işi için `jose` ile elle JWT üretmek yeterli, Fireflies
// GraphQL istemcisi de aynı şekilde elle yazılmıştı.

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
