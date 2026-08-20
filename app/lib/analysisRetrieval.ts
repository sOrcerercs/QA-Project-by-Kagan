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

export function extractKeywords(question: string): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const word of normalizeAgentName(question).split(/[^a-z0-9]+/)) {
    if (word.length < 3) continue;
    if (STOPWORDS.has(word)) continue;
    if (seen.has(word)) continue;
    seen.add(word);
    out.push(word);
    if (out.length >= MAX_KEYWORDS) break;
  }
  return out;
}

export const CONTEXT_CHAR_BUDGET = 900_000; // ~257k token — 1M pencerenin güvenli altı
export const MAX_CALLS = 60;                // model onlarca blok arasında kaybolmasın
export const MAX_TRANSCRIPT_CHARS = 25_000; // tek dev transcript (75k) bütçeyi yemesin
// Raporlar prod'da transcript kadar uzun (ortalama 10.7k, en uzunu 1,5M karakter).
// Kırpılmazsa bütçenin yarısını yiyor ve havuzdan çok daha az çağrı sığıyordu.
export const MAX_REPORT_CHARS = 8_000;

export interface AnalysisCall {
  id: string;
  agentName: string;
  customerName: string;
  callDate: Date;
  callType: string;
  score: number;
  transcript: string;
  report: string;
}

export interface SelectionResult {
  selected: AnalysisCall[];
  poolCount: number;
  usedCount: number;
  truncated: boolean;
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

export function selectContext(calls: AnalysisCall[], keywords: string[]): SelectionResult {
  const poolCount = calls.length;
  if (poolCount === 0) return { selected: [], poolCount: 0, usedCount: 0, truncated: false };

  const totalCost = calls.reduce((sum, c) => sum + contextCost(c), 0);

  // Havuz olduğu gibi sığıyorsa hiç seçim yapmayız — tam kapsama.
  if (poolCount <= MAX_CALLS && totalCost <= CONTEXT_CHAR_BUDGET) {
    return {
      selected: [...calls].sort(newestFirst),
      poolCount,
      usedCount: poolCount,
      truncated: false,
    };
  }

  // Sığmıyor: soruya en yakın çağrıları seç. Puanlar bir kez hesaplanır.
  // Sıralama: (1) kaç farklı anahtar kelime geçiyor, (2) toplam isabet,
  // (3) daha yeni çağrı.
  const scored = calls.map((c) => ({
    c,
    matched: matchedKeywordCount(c, keywords),
    hits: scoreCall(c, keywords),
  }));
  scored.sort(
    (a, b) => b.matched - a.matched || b.hits - a.hits || newestFirst(a.c, b.c)
  );

  const selected: AnalysisCall[] = [];
  let used = 0;
  for (const { c } of scored) {
    if (selected.length >= MAX_CALLS) break;
    const cost = contextCost(c);
    if (used + cost > CONTEXT_CHAR_BUDGET) continue; // büyük olanı atla, doldurmaya devam et
    selected.push(c);
    used += cost;
  }

  return {
    selected: selected.sort(newestFirst),
    poolCount,
    usedCount: selected.length,
    truncated: selected.length < poolCount,
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

function ymd(d: Date): string {
  return d.toISOString().slice(0, 10);
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
