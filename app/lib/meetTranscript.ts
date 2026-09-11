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
