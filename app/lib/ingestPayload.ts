// Apps Script'in POST ettiği gövdenin doğrulaması.
//
// Saf tutuluyor: rota sadece çağırır, karar burada. Her ret GÖRÜNÜR bir
// sebep döndürür — "gürültülü hata, sessiz düşme yok" kuralı gereği
// hiçbir alan sessizce varsayılana düşmez.

/** Drive dosya/klasör ID'leri en az 10 karakter, URL-güvenli alfabe. */
const FOLDER_ID_RE = /^[A-Za-z0-9_-]{10,}$/;
/** ISO 8601 biçimi: YYYY-MM-DDTHH:MM:SS... */
const ISO_LIKE_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/;
/** ISO 8601'in sonunda Z veya ±HH:MM olmak ZORUNDA. */
const HAS_OFFSET_RE = /(?:Z|[+-]\d{2}:?\d{2})$/;

export interface IngestPayload {
  meetFolderId: string;
  agentEmail: string;
  startedAt: Date;
  transcript: string;
  sourceFileId: string | null;
}

export type PayloadError =
  | "meetFolderId_missing" | "meetFolderId_format"
  | "agentEmail_missing"   | "agentEmail_format"
  | "startedAt_missing"    | "startedAt_format" | "startedAt_no_offset"
  | "transcript_missing";

function metin(v: unknown): string | null {
  return typeof v === "string" ? v : null;
}

export function parseIngestPayload(
  body: unknown,
): { ok: true; value: IngestPayload } | { ok: false; error: PayloadError } {
  const b = (typeof body === "object" && body !== null ? body : {}) as Record<string, unknown>;

  const meetFolderId = metin(b.meetFolderId)?.trim();
  if (!meetFolderId) return { ok: false, error: "meetFolderId_missing" };
  if (!FOLDER_ID_RE.test(meetFolderId)) return { ok: false, error: "meetFolderId_format" };

  const agentEmailHam = metin(b.agentEmail)?.trim();
  if (!agentEmailHam) return { ok: false, error: "agentEmail_missing" };
  const agentEmail = agentEmailHam.toLowerCase();
  if (!agentEmail.includes("@") || /\s/.test(agentEmail)) {
    return { ok: false, error: "agentEmail_format" };
  }

  const startedAtHam = metin(b.startedAt)?.trim();
  if (!startedAtHam) return { ok: false, error: "startedAt_missing" };
  // Önce ISO biçimi kontrol: "dun" gibi bozuk değeri hemen çıkar.
  if (!ISO_LIKE_RE.test(startedAtHam)) return { ok: false, error: "startedAt_format" };
  // Ofset YOKSA reddediyoruz: yerel saat varsaymak çağrı saatini sessizce
  // 3 saat kaydırır ve bunu kimse fark etmez.
  if (!HAS_OFFSET_RE.test(startedAtHam)) return { ok: false, error: "startedAt_no_offset" };
  const startedAt = new Date(startedAtHam);
  if (Number.isNaN(startedAt.getTime())) return { ok: false, error: "startedAt_format" };

  const transcript = metin(b.transcript);
  if (!transcript || transcript.trim().length === 0) {
    return { ok: false, error: "transcript_missing" };
  }

  const sourceFileId = metin(b.sourceFileId)?.trim() || null;

  return { ok: true, value: { meetFolderId, agentEmail, startedAt, transcript, sourceFileId } };
}
