// Sistem öncesi aylara ait, dışarıda hesaplanmış OKR değerleri.
//
// Kaynak: kullanıcının 2026-08-14'te paylaştığı "ŞUBAT OKR.xlsx" ve
// "MART OKR.xlsx" dosyalarının toplam satırı. Programdaki en eski
// değerlendirme 18 Mayıs 2026 olduğu için bu iki ay hesaplanamıyor.
//
// Neden tablo değil de sabit: iki ay geçmişte kaldı, değerleri bir daha
// değişmeyecek ve toplam 8 sayı. Üretim veritabanına şema eklemek, Excel
// parser yazmak ve yükleme formu kurmak bu iş için gereksiz karmaşıklık
// olurdu. Yeni bir geçmiş ay gerekirse buraya bir satır eklenir.
//
// KAPSAM (2026-08-15'te veri sahibi netleştirdi): bu aylardaki kayıtların
// TAMAMI ikinci görüşme. evaCount = ayın ikinci görüşme sayısı, "tüm
// değerlendirmeler" DEĞİL. Önceki not bunun tersini varsayıyordu, yanlıştı.
//
// Mayıs sonrasıyla kalan farklar (havuzlarken hesaba kat):
//   * Stem Cell / Premium: popülasyon aynı (ikinci görüşme). Tek fark, program
//     NA sayılan çağrıları paydadan düşüyor (bkz. app/lib/okr.ts upsellRate,
//     effectiveStatus), elle girilen toplamlarda böyle bir ayıklama yok. Bu,
//     Şubat/Mart oranlarını olduğundan bir miktar DÜŞÜK gösterir.
//   * Kalite skoru danışman skorlarının AĞIRLIKSIZ ortalaması; program çağrı
//     bazında ortalıyor. Excel'in toplam satırında QA Score hücresi boştu.
//     Ayrıca bu değer yalnızca ikinci görüşmelerden gelirken, panelin kalite
//     kartı (çağrı tipi filtresi "Tümü" iken) birinci görüşmeleri de içeriyor.
// Bu yüzden arayüzde "elle girildi" rozetiyle ve paydası yazılarak gösteriliyor.
// 2026-08-15'te kullanıcı, farkı bilerek, bu ayların "Tüm Aylar" havuzuna
// KATILMASINI istedi (bkz. poolUpsellWithHistory).

import { monthsBetween, ALL_MONTHS } from "./okr";
import type { UpsellRateResult } from "./okr";

export interface OkrHistoryMonth {
  /** Danışman skorlarının ağırlıksız ortalaması. */
  quality: number;
  /** Ortalamaya giren danışman sayısı (skoru boş olanlar hariç). */
  qualityAgents: number;
  /** Ayın ikinci görüşme sayısı — oranların paydası (bkz. KAPSAM notu). */
  evaCount: number;
  /** Stem Cell paketi sunulan görüşme sayısı. */
  stemCell: number;
  /** Premium paket sunulan görüşme sayısı. */
  premium: number;
}

export const OKR_HISTORY: Record<string, OkrHistoryMonth> = {
  "2026-02": { quality: 78.45, qualityAgents: 18, evaCount: 195, stemCell: 178, premium: 172 },
  "2026-03": { quality: 82.48, qualityAgents: 20, evaCount: 232, stemCell: 210, premium: 200 },
};

export function getHistoryMonth(month: string): OkrHistoryMonth | null {
  return OKR_HISTORY[month] ?? null;
}

export function isHistoryMonth(month: string): boolean {
  return getHistoryMonth(month) !== null;
}

/** Elle girilen aylar, artan sırada. */
export function historyMonths(): string[] {
  return Object.keys(OKR_HISTORY).sort();
}

/** Excel'deki yuvarlanmış oran yerine ham sayılardan hesaplanır. */
export function historyRate(
  h: OkrHistoryMonth,
  field: "stemCell" | "premium"
): number | null {
  if (h.evaCount <= 0) return null;
  return Math.round((h[field] / h.evaCount) * 10000) / 100;
}

const round2 = (n: number) => Math.round(n * 100) / 100;

export interface HistoryTotals {
  evaCount: number;
  stemCell: number;
  premium: number;
  /** Σ (ayın kalitesi × ayın değerlendirme sayısı) — ağırlıklı ortalama payı. */
  qualityWeightedSum: number;
}

/** Elle girilen tüm ayların ham toplamı. */
export function historyTotals(): HistoryTotals {
  let evaCount = 0, stemCell = 0, premium = 0, qualityWeightedSum = 0;
  for (const m of historyMonths()) {
    const h = OKR_HISTORY[m];
    evaCount += h.evaCount;
    stemCell += h.stemCell;
    premium += h.premium;
    qualityWeightedSum += h.quality * h.evaCount;
  }
  return { evaCount, stemCell, premium, qualityWeightedSum };
}

/**
 * Elle girilen ayları "Tüm Aylar" oranına katar.
 *
 * Sunulmayan sayısı `evaCount − sunulan` olarak türetiliyor. Popülasyon her iki
 * dönemde de ikinci görüşme (bkz. dosya başındaki KAPSAM notu), ama elle girilen
 * toplamlarda NA kırılımı olmadığı için NA sayılması gereken çağrılar burada
 * "sunulmadı" tarafına düşüyor. Hesaplanan aylarda NA artık POZİTİF sayıldığı
 * için (bkz. okr.ts upsellRate) bu fark Şubat/Mart'ı olduğundan düşük gösterir.
 * Kullanıcı bunu bilerek havuzlamayı seçti (2026-08-15). Kural yalnızca burada,
 * ALL görünümünde uygulanır — tek ay kartları etkilenmez.
 *
 * NA / BILINMIYOR / kusursuz puan / muafiyet sayaçları hesaplanan aylardan
 * gelmeye devam eder: elle girilen ayların böyle bir kırılımı yok.
 */
export function poolUpsellWithHistory(
  rate: UpsellRateResult,
  field: "stemCell" | "premium"
): UpsellRateResult {
  const t = historyTotals();
  const presented = rate.presented + t[field];
  const notPresented = rate.notPresented + (t.evaCount - t[field]);
  const denom = presented + notPresented;
  return {
    ...rate,
    presented,
    notPresented,
    value: denom === 0 ? null : round2((presented / denom) * 100),
  };
}

/**
 * Kaliteyi elle girilen aylarla havuzlar.
 *
 * İki yaklaşıklık var:
 *   1. Excel'deki `quality`, danışman skorlarının AĞIRLIKSIZ ortalaması; burada
 *      ayın çağrı sayısıyla ağırlıklandırılıyor. Ham çağrı skorları elimizde
 *      olmadığı için daha iyisi mümkün değil.
 *   2. Bu değer yalnızca ikinci görüşmelerden geliyor; kalite kartı çağrı tipi
 *      filtresi "Tümü" iken birinci görüşmeleri de içerdiği için iki dönem
 *      farklı popülasyonu ortalıyor.
 */
export function poolQualityWithHistory(
  quality: { value: number | null; count: number }
): { value: number | null; count: number } {
  const t = historyTotals();
  const count = quality.count + t.evaCount;
  if (count === 0) return { value: null, count: 0 };
  const sum = (quality.value ?? 0) * quality.count + t.qualityWeightedSum;
  return { value: round2(sum / count), count };
}

/**
 * Ay seçicisinin listesi: ALL, hesaplanan aylar (yeniden eskiye), sonra elle
 * girilen geçmiş aylar (yeniden eskiye). Hesaplanan aralığa düşen bir geçmiş ay
 * tekrarlanmaz — hesaplanan veri her zaman önceliklidir.
 */
export function availableMonthsWithHistory(firstDataMonth: string, nowMonth: string): string[] {
  const computed = monthsBetween(firstDataMonth, nowMonth).reverse();
  const seen = new Set(computed);
  const manual = historyMonths().reverse().filter((m) => !seen.has(m));
  return [ALL_MONTHS, ...computed, ...manual];
}
