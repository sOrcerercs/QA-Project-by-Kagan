// Analiz sohbetinde Gemini'ye gönderilecek bağlamı seçen saf fonksiyonlar.
// DB'ye ve Gemini'ye dokunmaz — route.ts bunları sırayla çağırır.
//
// Neden bir seçim katmanı gerekiyor: prod'da son 30 günde 1.500 çağrı ×
// ~11.000 karakter ≈ 4M token. Gemini 2.5 Flash'ın 1M penceresi bile
// yetmiyor, dolayısıyla havuz her zaman olduğu gibi gönderilemez.
import { normalizeAgentName } from "@/app/lib/agentMatch";

export const MAX_KEYWORDS = 8;

// normalizeAgentName'den geçmiş (katlanmış) biçimde tutulur: "için" → "icin".
const STOPWORDS = new Set([
  "ama", "ana", "ancak", "bana", "bazi", "belki", "ben", "beni", "bir", "biraz",
  "birde", "biri", "bize", "bosuna", "bunda", "bundan", "bunlar", "bunu",
  "bunun", "cok", "cunku", "daha", "dahi", "de", "diye", "eger", "gibi", "hem",
  "hangi", "hep", "hepsi", "her", "icin", "ile", "ilgili", "kac", "kadar",
  "kendi", "ki", "kim", "mi", "mu", "mus", "nasil", "ne", "neden", "nedir",
  "nerede", "niye", "olan", "olarak", "oldu", "olsun", "olur", "onlar", "onun",
  "sana", "sen", "siz", "sonra", "sunlar", "sey", "tum", "tumu", "vardi", "var",
  "veya", "yani", "yine", "yok", "yoksa",
  // İngilizce yaygınlar (soru İngilizce de yazılabilir)
  "and", "are", "did", "does", "for", "from", "has", "have", "how", "many",
  "much", "not", "the", "there", "was", "were", "what", "which", "who", "why",
  "with", "you",
]);

export function extractKeywords(question: string, limit: number = MAX_KEYWORDS): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const word of normalizeAgentName(question).split(/[^a-z0-9]+/)) {
    if (word.length < 3) continue;
    if (STOPWORDS.has(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= limit) break;
  }
  return out;
}

// Takip sorularının çözdüğü sorun: "Bu danışmanın zayıf yönü ne?" sorusunda
// kişi adı geçmiyor, dolayısıyla o kişinin çağrıları havuza hiç girmiyor ve
// model başka birini anlatıyordu. Önceki cevaptaki özel adları (ad + soyad
// biçiminde ardışık büyük harfle başlayan sözcükler) anahtar kelimelere
// taşıyoruz. En fazla 2 ad alınır — fazlası seçimi sulandırır.
export function extractNames(text: string, maxNames = 2): string[] {
  // \b kullanılmaz: ASCII tabanlı olduğu için Ş/İ/Ö ile başlayan adları kaçırıyor.
  const pattern = /[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,}(?:\s+[A-ZÇĞİÖŞÜ][a-zçğıöşü]{1,})+/g;
  const tokens: string[] = [];
  const seenNames = new Set<string>();
  for (const match of text.match(pattern) ?? []) {
    const norm = normalizeAgentName(match);
    if (seenNames.has(norm)) continue;
    seenNames.add(norm);
    for (const part of norm.split(/\s+/)) {
      if (part.length >= 3 && !tokens.includes(part)) tokens.push(part);
    }
    if (seenNames.size >= maxNames) break;
  }
  return tokens;
}

// Sorunun anahtar kelimeleri + (varsa) önceki cevaptaki kişi adları.
export function buildKeywords(question: string, priorAnswer?: string): string[] {
  const primary = extractKeywords(question);
  if (!priorAnswer) return primary;
  const names = extractNames(priorAnswer).filter((n) => !primary.includes(n));
  return [...primary, ...names];
}

export const CONTEXT_CHAR_BUDGET = 900_000; // ~257k token — 1M pencerenin güvenli altı
export const MAX_CALLS = 60;                // model onlarca blok arasında kaybolmasın
export const MAX_TRANSCRIPT_CHARS = 25_000; // tek dev transcript (75k) bütçeyi yemesin
// Raporlar prod'da transcript kadar uzun (ortalama 10.7k, en uzunu 1,5M karakter).
// Kırpılmazsa bütçenin yarısını yiyor ve havuzdan çok daha az çağrı sığıyordu.
export const MAX_REPORT_CHARS = 8_000;

export interface AnalysisCall {
  id: string;
  agentId: string;
  agentName: string;
  customerName: string;
  callDate: Date;
  callType: string;
  score: number;
  transcript: string;
  report: string;
}

// Kişi başına payda: "Koray 13/13 · Harun 15/15". Sayım ve kıyas cevaplarının
// doğrulanabilmesi için tek toplam sayı yetmiyor.
export interface AgentCoverage {
  agentId: string;
  agentName: string;
  pool: number;
  used: number;
}

export interface SelectionResult {
  selected: AnalysisCall[];
  poolCount: number;
  usedCount: number;
  truncated: boolean;
  perAgent: AgentCoverage[];
}

const CALL_TYPE_TR: Record<string, string> = {
  FIRST_CALL: "İlk Görüşme",
  SECOND_CALL: "İkinci Görüşme",
  FOLLOW_UP: "Takip Görüşmesi",
  GENERAL: "Genel",
};

// Bir çağrının bağlam bütçesinden yiyeceği karakter miktarı.
function contextCost(c: AnalysisCall): number {
  return (
    Math.min(c.transcript.length, MAX_TRANSCRIPT_CHARS) +
    Math.min(c.report?.length ?? 0, MAX_REPORT_CHARS)
  );
}

// Toplam isabet sayısı. Tek başına sıralama ölçütü olarak kullanılmaz: uzun
// transcriptler sırf uzun oldukları için daha çok isabet topluyor.
export function scoreCall(call: AnalysisCall, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const hay = normalizeAgentName(`${call.transcript}\n${call.report ?? ""}`);
  let total = 0;
  for (const k of keywords) {
    let idx = hay.indexOf(k);
    while (idx !== -1) {
      total++;
      idx = hay.indexOf(k, idx + k.length);
    }
  }
  return total;
}

// Kaç FARKLI anahtar kelime geçiyor. Sıralamanın birincil ölçütü — uzunluk
// yanlılığı taşımaz: 3 farklı kelimeyi barındıran kısa bir çağrı, aynı kelimeyi
// 20 kez tekrarlayan uzun bir çağrıdan önce gelir.
export function matchedKeywordCount(call: AnalysisCall, keywords: string[]): number {
  if (keywords.length === 0) return 0;
  const hay = normalizeAgentName(`${call.transcript}\n${call.report ?? ""}`);
  let matched = 0;
  for (const k of keywords) if (hay.includes(k)) matched++;
  return matched;
}

const newestFirst = (a: AnalysisCall, b: AnalysisCall) => b.callDate.getTime() - a.callDate.getTime();

function coverage(calls: AnalysisCall[], selected: AnalysisCall[]): AgentCoverage[] {
  const byAgent = new Map<string, AgentCoverage>();
  for (const c of calls) {
    const cur = byAgent.get(c.agentId) ?? { agentId: c.agentId, agentName: c.agentName, pool: 0, used: 0 };
    cur.pool++;
    byAgent.set(c.agentId, cur);
  }
  const usedIds = new Set(selected.map((s) => s.id));
  for (const c of calls) {
    if (usedIds.has(c.id)) byAgent.get(c.agentId)!.used++;
  }
  return [...byAgent.values()].sort(
    (a, b) => b.used - a.used || b.pool - a.pool || a.agentName.localeCompare(b.agentName, "tr")
  );
}

export function selectContext(calls: AnalysisCall[], keywords: string[]): SelectionResult {
  const poolCount = calls.length;
  if (poolCount === 0) {
    return { selected: [], poolCount: 0, usedCount: 0, truncated: false, perAgent: [] };
  }

  const totalCost = calls.reduce((sum, c) => sum + contextCost(c), 0);

  // Havuz olduğu gibi sığıyorsa hiç seçim yapmayız — tam kapsama.
  if (poolCount <= MAX_CALLS && totalCost <= CONTEXT_CHAR_BUDGET) {
    const selected = [...calls].sort(newestFirst);
    return {
      selected,
      poolCount,
      usedCount: poolCount,
      truncated: false,
      perAgent: coverage(calls, selected),
    };
  }

  // Sığmıyor: her danışmandan sırayla birer çağrı alarak bütçeyi eşit paylaştır.
  // Küresel sıralama yapılsa bütçe tek bir danışmana akıyor (prod ölçümü: 4
  // danışmanlık havuzda 31 vs 6) ve kişi başı oran kıyası anlamsızlaşıyordu.
  // Her danışmanın kendi kuyruğu alaka sırasına göre dizilir.
  const scored = calls.map((c) => ({
    c,
    matched: matchedKeywordCount(c, keywords),
    hits: scoreCall(c, keywords),
  }));

  const groups = new Map<string, typeof scored>();
  for (const s of scored) {
    const g = groups.get(s.c.agentId);
    if (g) g.push(s);
    else groups.set(s.c.agentId, [s]);
  }

  const queues = [...groups.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([, g]) =>
      g.sort((a, b) => b.matched - a.matched || b.hits - a.hits || newestFirst(a.c, b.c))
    );

  const cursors = queues.map(() => 0);
  const selected: AnalysisCall[] = [];
  let used = 0;
  let progressed = true;

  while (progressed && selected.length < MAX_CALLS) {
    progressed = false;
    for (let qi = 0; qi < queues.length && selected.length < MAX_CALLS; qi++) {
      const queue = queues[qi];
      while (cursors[qi] < queue.length) {
        const candidate = queue[cursors[qi]++];
        const cost = contextCost(candidate.c);
        if (used + cost > CONTEXT_CHAR_BUDGET) continue; // sığmayanı atla
        selected.push(candidate.c);
        used += cost;
        progressed = true;
        break;
      }
    }
  }

  const ordered = selected.sort(newestFirst);
  return {
    selected: ordered,
    poolCount,
    usedCount: ordered.length,
    truncated: ordered.length < poolCount,
    perAgent: coverage(calls, ordered),
  };
}

export function truncateTranscript(text: string): string {
  if (text.length <= MAX_TRANSCRIPT_CHARS) return text;
  return `${text.slice(0, MAX_TRANSCRIPT_CHARS)}\n… [transcript kısaltıldı]`;
}

export function truncateReport(text: string): string {
  if (text.length <= MAX_REPORT_CHARS) return text;
  return `${text.slice(0, MAX_REPORT_CHARS)}\n… [rapor kısaltıldı]`;
}

export function buildContextBlock(calls: AnalysisCall[]): string {
  return calls
    .map((c, i) => {
      const head =
        `### Çağrı #${i + 1}\n` +
        `Danışman: ${c.agentName} | Tarih: ${ymd(c.callDate)} | ` +
        `Tip: ${CALL_TYPE_TR[c.callType] ?? c.callType} | Puan: ${c.score} | ` +
        `Müşteri: ${c.customerName}`;
      const report = (c.report ?? "").trim();
      const reportPart = report ? `\n--- DEĞERLENDİRME RAPORU ---\n${truncateReport(report)}` : "";
      return `${head}\n--- TRANSCRIPT ---\n${truncateTranscript(c.transcript)}${reportPart}`;
    })
    .join("\n\n");
}

/* ── Tarih aralığı ── */

function parseDateOnly(value: unknown): Date | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

export interface DateRange {
  start: Date;
  end: Date;
  endExclusive: Date; // bitiş gününü tam kapsar (23:59:59.999)
}

// Geçersiz/eksik tarihte son 30 güne düşer; ters aralıkta null döner (400).
export function resolveRange(startRaw: unknown, endRaw: unknown, now: Date): DateRange | null {
  const end = parseDateOnly(endRaw) ?? now;
  const start = parseDateOnly(startRaw) ?? new Date(end.getTime() - 30 * 24 * 60 * 60 * 1000);
  if (start > end) return null;
  const endExclusive = new Date(end);
  endExclusive.setUTCHours(23, 59, 59, 999);
  return { start, end, endExclusive };
}

export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
}
