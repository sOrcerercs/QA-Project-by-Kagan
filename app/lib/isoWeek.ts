// ISO hafta yardımcıları. Hafta Pazartesi başlar, Pazar biter (ISO-8601).
// Tüm hesap YEREL saatte yapılır; değerlendirmeler TR gününe göre okunuyor.

/** Verilen tarihin içinde bulunduğu haftanın Pazartesi 00:00'ı. */
export function weekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

/** Verilen tarihin içinde bulunduğu haftanın Pazar 23:59:59.999'u. */
export function weekEnd(date: Date): Date {
  const d = weekStart(date);
  d.setDate(d.getDate() + 6);
  d.setHours(23, 59, 59, 999);
  return d;
}

/** "2026-W38" biçiminde ISO hafta anahtarı. */
export function isoWeekKey(date: Date): string {
  // ISO haftası, içinde bulunduğu Perşembe'nin yılına aittir.
  const d = weekStart(date);
  d.setDate(d.getDate() + 3);
  const year = d.getFullYear();
  const jan4 = new Date(year, 0, 4);
  const firstMonday = weekStart(jan4);
  const weekNum = Math.round((d.getTime() - firstMonday.getTime()) / (7 * 86400000)) + 1;
  return `${year}-W${String(weekNum).padStart(2, "0")}`;
}

const KEY = /^(\d{4})-W(\d{2})$/;

/** "2026-W38" → o haftanın aralığı. Biçim ya da numara geçersizse null. */
export function parseWeekKey(key: string): { start: Date; end: Date } | null {
  const m = KEY.exec((key ?? "").trim());
  if (!m) return null;
  const year = Number(m[1]);
  const week = Number(m[2]);
  if (week < 1 || week > 53) return null;
  const firstMonday = weekStart(new Date(year, 0, 4));
  const start = new Date(firstMonday);
  start.setDate(start.getDate() + (week - 1) * 7);
  // 53. hafta her yılda yok; taşmışsa geçersiz say.
  if (isoWeekKey(start) !== `${year}-W${String(week).padStart(2, "0")}`) return null;
  return { start, end: weekEnd(start) };
}
