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
// DİKKAT — bu değerler Mayıs sonrasıyla AYNI ŞEYİ ÖLÇMÜYOR:
//   * Stem Cell / Premium oranının paydası TÜM değerlendirmeler (evaCount).
//     Program ise sunuldu/(sunuldu+sunulmadı) hesaplıyor, yalnızca ikinci
//     görüşmelerde ve NA'ları paydadan düşerek (bkz. app/lib/okr.ts upsellRate).
//   * Kalite skoru danışman skorlarının AĞIRLIKSIZ ortalaması; program çağrı
//     bazında ortalıyor. Excel'in toplam satırında QA Score hücresi boştu.
// Bu yüzden arayüzde "elle girildi" rozetiyle ve paydası yazılarak gösteriliyor,
// "Tüm Aylar" kümülatif havuzuna KATILMIYOR.

import { monthsBetween, ALL_MONTHS } from "./okr";

export interface OkrHistoryMonth {
  /** Danışman skorlarının ağırlıksız ortalaması. */
  quality: number;
  /** Ortalamaya giren danışman sayısı (skoru boş olanlar hariç). */
  qualityAgents: number;
  /** Ayın toplam değerlendirme sayısı — oranların paydası. */
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
