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

export const CONTEXT_CHAR_BUDGET = 600_000; // ~170k token — 1M pencerenin güvenli altı
export const MAX_CALLS = 60;                // model onlarca blok arasında kaybolmasın
export const MAX_TRANSCRIPT_CHARS = 25_000; // tek dev transcript (75k) bütçeyi yemesin

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
  return Math.min(c.transcript.length, MAX_TRANSCRIPT_CHARS) + (c.report?.length ?? 0);
}

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
  const scored = calls.map((c) => ({ c, score: scoreCall(c, keywords) }));
  scored.sort((a, b) => b.score - a.score || newestFirst(a.c, b.c));

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
      const reportPart = report ? `\n--- DEĞERLENDİRME RAPORU ---\n${report}` : "";
      return `${head}\n--- TRANSCRIPT ---\n${truncateTranscript(c.transcript)}${reportPart}`;
    })
    .join("\n\n");
}
