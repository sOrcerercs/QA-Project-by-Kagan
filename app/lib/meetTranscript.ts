import { matchAgentName, normalizeAgentName } from "./agentMatch";

// Google Meet transkript Doc'unun düz metin hâlini ayrıştırır.
//
// Meet satır başına zaman damgası VERMEZ; 5 dakikalık blok başlıkları verir.
// Bu yüzden her konuşma, içinde bulunduğu bloğun ARALIĞINI alır. Blok içinde
// enterpolasyon bilinçli olarak yapılmıyor: uydurma kesinlik üretir ve
// kayıttan doğrulamaya kalkan biri damganın yanlış yeri gösterdiğini görür.

const BLOCK_SECONDS = 300;

/** `00:05:00` — yalnızca saatten oluşan satır (blok damgası). */
const BLOCK_MARK_RE = /^(\d{1,2}):(\d{2}):(\d{2})$/;
/** `Meeting ended after 00:25:01` — sonunda bozuk karakter olabiliyor. */
const ENDED_AFTER_RE = /^Meeting ended after\s+(\d{1,2}):(\d{2}):(\d{2})/;
/** `İsim: metin` — isim tarafında `:` olmayacağı varsayımıyla. */
const UTTERANCE_RE = /^([^:]{1,80}):\s*(.*)$/;

export interface MeetUtterance {
  speaker: string;
  text: string;
  blockStartSec: number;
  blockEndSec: number;
}

export interface ParsedMeetTranscript {
  attendees: string[];
  utterances: MeetUtterance[];
  durationSec: number | null;
}

/**
 * Markdown kalıntısını temizler. Fixture'ın connector üzerinden alınmış
 * hâlinde `## **...**` görüldü; gerçek export'ta olmayabilir. Tolerans
 * ucuz, sürpriz pahalı.
 */
function normalizeLine(line: string): string {
  return line
    .replace(/\*\*/g, "")
    .replace(/^#+\s*/, "")
    .replace(/^\*|\*$/g, "")
    .trim();
}

function toSeconds(h: string, m: string, s: string): number {
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
}

export function parseMeetTranscript(raw: string): ParsedMeetTranscript {
  const lines = raw
    .split(/\r?\n/)
    .map(normalizeLine)
    .filter(l => l.length > 0);

  const attendees: string[] = [];
  const utterances: MeetUtterance[] = [];
  let durationSec: number | null = null;

  // Bölüm durumu: başlıklar arası geçiş. "done" terminal — "Meeting ended
  // after" satırından sonrasını hiç işleme, çünkü ardından gelen dipnot
  // (`*...bilgisayar tarafından üretildi...*`) asteriksleri temizlendikten
  // sonra `:` içermeyen düz bir metin olur ve UTTERANCE_RE eşleşmediği için
  // "önceki konuşmanın devamı" dalına düşüp son konuşmayı kirletirdi.
  let section: "head" | "attendees" | "body" | "done" = "head";
  let blockIndex = 0;

  for (const line of lines) {
    if (section === "done") continue;

    if (/^Attendees$/i.test(line)) { section = "attendees"; continue; }
    if (/^Transcript$/i.test(line)) { section = "body"; continue; }

    const ended = ENDED_AFTER_RE.exec(line);
    if (ended) {
      durationSec = toSeconds(ended[1], ended[2], ended[3]);
      section = "done";
      continue;
    }

    if (section === "attendees") {
      if (attendees.length === 0) {
        for (const part of line.split(",")) {
          const name = part.trim();
          if (name) attendees.push(name);
        }
      }
      continue;
    }

    if (section !== "body") continue;

    const mark = BLOCK_MARK_RE.exec(line);
    if (mark) {
      // Damga mutlak zamanı verir; blok indeksini ondan türet.
      blockIndex = Math.round(toSeconds(mark[1], mark[2], mark[3]) / BLOCK_SECONDS);
      continue;
    }

    const utt = UTTERANCE_RE.exec(line);
    if (utt) {
      utterances.push({
        speaker: utt[1].trim(),
        text: utt[2].trim(),
        blockStartSec: blockIndex * BLOCK_SECONDS,
        blockEndSec: (blockIndex + 1) * BLOCK_SECONDS,
      });
      continue;
    }

    // Ön eksiz satır → önceki konuşmanın devamı.
    const prev = utterances[utterances.length - 1];
    if (prev) prev.text = `${prev.text} ${line}`.trim();
  }

  // Son bloğun sonu: süre biliniyorsa ondan, bilinmiyorsa +5 dakika.
  if (utterances.length > 0) {
    const last = utterances[utterances.length - 1];
    const lastBlockStart = last.blockStartSec;
    const end =
      durationSec != null && durationSec > lastBlockStart
        ? durationSec
        : lastBlockStart + BLOCK_SECONDS;
    for (const u of utterances) {
      if (u.blockStartSec === lastBlockStart) u.blockEndSec = end;
    }
  }

  return { attendees, utterances, durationSec };
}

/** Süre eşiği — Kriko ve Fireflies'ın uyguladığı 2 dakikanın aynısı. */
const MIN_DURATION_SEC = 120;
/** Metin eşiği — Kriko ve Fireflies'ın uyguladığı 50 karakterin aynısı. */
const MIN_TEXT_LENGTH = 50;

export type MeetSkipReason =
  | "attendee_count"
  | "agent_role_ambiguous"
  | "too_short"
  | "too_short_text";

export interface MeetRoles {
  agentAttendee: string;
  customerAttendee: string;
}

/** Saniye → `MM:SS`. 60 dakikayı aşan çağrıda dakika büyür (`65:00`). */
function formatClock(totalSec: number): string {
  const m = Math.floor(totalSec / 60);
  const s = Math.round(totalSec % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** `00:00–05:00` — Kriko'nun kullandığı aralık biçiminin aynısı (en tire). */
export function formatBlockRange(startSec: number, endSec: number): string {
  return `${formatClock(startSec)}–${formatClock(endSec)}`;
}

/**
 * Hangi katılımcının danışman olduğunu bulur.
 *
 * Danışmanın KİM olduğu driveEmail'den kesin biliniyor; burada yalnızca
 * katılımcı listesindeki hangi ADIN o kişi olduğu aranıyor.
 *
 * allowSingleWord KAPALI: açık olsa "Livia" adlı bir MÜŞTERİ, "Livia Goga"
 * danışmanıyla eşleşip Agent rolünü kapabilirdi. Rolleri ters yazmak
 * transkriptin tamamını bozar.
 *
 * allowPartial AÇIK: DB'de resmî tam adlar var — "Makbule Sinem Bulur"
 * katılımcı listesinde "Sinem Bulur" olarak geçiyor ve eşleşmesi gerekiyor.
 * Ama bu katman ham String.includes kullanıyor: müşterinin adı danışmanın
 * DB adının rastgele bir alt dizesi olabilir — "Mavi Can" katılımcısı
 * "Mavican Tekuz" danışmanının içinde "mavi" VE "can" olarak geçtiği için
 * eşleşirdi. Bu yüzden matchAgentName'in bulduğu her adayı KELİME SINIRI
 * doğrulamasından geçiriyoruz: katılımcı adının normalize edilmiş her
 * parçası, aday adında TAM KELİME olarak geçmeli. agentMatch'in kendi
 * normalizasyonunu (Türkçe I, x/ks katlaması) kullanıyoruz ki iki taraf
 * aynı dili konuşsun.
 */
export function resolveMeetRoles(attendees: string[], agentName: string): MeetRoles | null {
  if (attendees.length !== 2) return null;
  const candidates = [{ id: "agent", name: agentName }];
  const candidateParts = normalizeAgentName(agentName).split(/\s+/).filter(Boolean);
  const hits = attendees.filter(a => {
    const match = matchAgentName(a, candidates, { allowSingleWord: false });
    if (!match) return false;
    const attendeeParts = normalizeAgentName(a).split(/\s+/).filter(Boolean);
    return attendeeParts.every(p => candidateParts.includes(p));
  });
  if (hits.length !== 1) return null;
  const agentAttendee = hits[0];
  const customerAttendee = attendees.find(a => a !== agentAttendee)!;
  return { agentAttendee, customerAttendee };
}

/**
 * `/api/analyze`'a gidecek metni kurar.
 *
 * Biçim Kriko ile BİREBİR aynı (`Agent [MM:SS–MM:SS]: ...`), yalnızca
 * çözünürlük daha kaba. Aynı şekil olduğu için prompt değişmiyor ve iki
 * kaynak tek dil konuşuyor.
 */
export function buildMeetTranscriptText(
  utterances: MeetUtterance[],
  roles: MeetRoles,
): string {
  return utterances
    .map(u => {
      const role = u.speaker === roles.agentAttendee ? "Agent" : "Customer";
      return `${role} [${formatBlockRange(u.blockStartSec, u.blockEndSec)}]: ${u.text}`;
    })
    .join("\n");
}

/**
 * Programın ikinci kapısı. Script zaten "consultation" filtresi uyguluyor;
 * bu katman ekip toplantısı, test kaydı ve yarım transkripti eler.
 * Her ret GÖRÜNÜR bir sebep döndürür — sessiz atlama yok.
 */
export function classifyMeetTranscript(
  parsed: ParsedMeetTranscript,
  agentName: string,
): { ok: true; roles: MeetRoles; text: string } | { ok: false; reason: MeetSkipReason } {
  if (parsed.attendees.length !== 2) return { ok: false, reason: "attendee_count" };

  const roles = resolveMeetRoles(parsed.attendees, agentName);
  if (!roles) return { ok: false, reason: "agent_role_ambiguous" };

  // Süre bilinmiyorsa eşik UYGULANMAZ: Fireflies'ta resolveDurationMinutes
  // null döndüğünde içerik kontrollerine güveniliyordu, aynı davranış.
  if (parsed.durationSec != null && parsed.durationSec < MIN_DURATION_SEC) {
    return { ok: false, reason: "too_short" };
  }

  const text = buildMeetTranscriptText(parsed.utterances, roles);
  if (text.trim().length < MIN_TEXT_LENGTH) return { ok: false, reason: "too_short_text" };

  return { ok: true, roles, text };
}
