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
