/**
 * reportData çevirisi için metin çıkarma / geri yerleştirme.
 *
 * TASARIM KURALI — bozma:
 * Çevrilecek alanlar TEK TEK SAYILMAZ. Blok baştan sona gezilir ve bir yasak
 * listesindekiler DIŞINDA her metin çevrilir. Böylece prompta yeni bir metin
 * alanı eklendiğinde (yeni bir kriter alanı, yeni bir bölüm) kod değişmeden
 * o alan da İngilizceye çevrilir.
 *
 * Yasak listesi — bunlar çeviriye ASLA girmez:
 *  - kanıt alıntısı (text) ve highlight: transkriptten birebir alıntı.
 *    Çağrılar zaten İngilizce; "çevrilmiş kanıt" kanıt sayılmaz. highlight da
 *    alıntının birebir alt dizesi olmak zorunda, alıntı çevrilmezse o da çevrilmez.
 *  - id / kod / zaman damgası / verdict gibi makine değerleri.
 *  - "<alan>En" alanları: zaten İngilizce.
 *  - Kardeşi "<alan>En" olan alanlar: promptun verdiği hazır çeviri kullanılır,
 *    aynı şeyi bir daha çevirmenin anlamı yok.
 *
 * Neden bloğu olduğu gibi modele verip "çevir" demiyoruz: model JSON'u yeniden
 * yazarken alan düşürüyor, sayıyı stringe çeviriyor, diziyi yeniden sıralıyor.
 * Dışarı yalnızca düz bir metin dizisi çıkıyor, geri de aynı uzunlukta bir
 * metin dizisi bekleniyor; yapı hiçbir aşamada modele emanet edilmiyor.
 */

/** Değeri makine verisi olan, çevrilmemesi gereken alan adları. */
const NEVER_TRANSLATE = new Set([
  "text",
  "highlight",
  "highlights",
  "id",
  "criterionId",
  "code",
  "key",
  "ts",
  "timestamp",
  "time",
  "verdict",
  "result",
  "status",
  "promptVersion",
  "schemaVersion",
  "callClassification",
  "classification",
]);

interface Slot {
  get: () => string;
  set: (v: string) => void;
}

function isDict(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function shouldTranslate(key: string, parent: Record<string, unknown>): boolean {
  if (NEVER_TRANSLATE.has(key)) return false;
  // Zaten İngilizce olan alan.
  if (key.endsWith("En")) return false;
  // Prompt hazır çeviri verdiyse kaynağı çevirmeye gerek yok.
  if (Object.prototype.hasOwnProperty.call(parent, key + "En")) return false;
  return true;
}

/**
 * Bloğu sabit sırada gezer (nesne anahtarları eklenme sırasında, diziler
 * indeks sırasında). collect ve apply aynı fonksiyonu kullandığı için iki
 * taraftaki sıra birebir aynıdır.
 */
function slotsOf(node: unknown): Slot[] {
  const out: Slot[] = [];

  const walk = (value: unknown): void => {
    if (Array.isArray(value)) {
      for (let i = 0; i < value.length; i++) {
        const item = value[i];
        if (typeof item === "string") continue; // dizi içindeki çıplak metinler atlanır
        walk(item);
      }
      return;
    }
    if (!isDict(value)) return;

    for (const key of Object.keys(value)) {
      const child = value[key];
      if (typeof child === "string") {
        if (!shouldTranslate(key, value)) continue;
        if (child.trim().length === 0) continue;
        const parent = value;
        out.push({
          get: () => parent[key] as string,
          set: (v: string) => {
            parent[key] = v;
          },
        });
      } else {
        walk(child);
      }
    }
  };

  walk(node);
  return out;
}

/** Çevrilecek metinler, sabit sırada. */
export function collectTranslatable(reportData: unknown): string[] {
  if (!isDict(reportData)) return [];
  return slotsOf(reportData).map((s) => s.get());
}

/**
 * Çevirileri geri yerleştirir. Uzunluk tutmuyorsa (model fazla/eksik satır
 * döndürdü) hiçbir şey uygulanmaz ve orijinal veri döner — yarım çevrilmiş,
 * satırları kaymış bir kart göstermektense Türkçe göstermek doğrudur.
 */
export function applyTranslations(reportData: unknown, translations: unknown): unknown {
  if (!isDict(reportData)) return reportData;
  if (!Array.isArray(translations)) return reportData;

  const clone = structuredClone(reportData);
  const slots = slotsOf(clone);
  if (slots.length !== translations.length) return reportData;

  for (let i = 0; i < slots.length; i++) {
    const t = translations[i];
    // Boş/geçersiz satırda o alanı olduğu gibi bırak.
    if (typeof t !== "string" || t.trim().length === 0) continue;
    slots[i].set(t.trim());
  }
  return clone;
}
