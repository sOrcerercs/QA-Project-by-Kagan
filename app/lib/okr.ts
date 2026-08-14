// OKR panelinin tüm hesabı. DB ve AI erişimi yoktur; veriyi parametre alır.
// reportAggregation.ts ile aynı deseni izler.
import type { UpsellStatus } from "@/app/lib/upsellClassify";

export const OKR_TARGETS = {
  quality: 99.5,
  stemCell: 95,
  bottomSellers: 98,
  premium: 90,
  automation: 100,
} as const;

// Kusursuz puan: bu skoru alan bir görüşmede upsell pozitif sayılır (bkz. upsellRate).
export const PERFECT_SCORE = 100;

// Türkiye'de 2016'dan beri yaz saati uygulaması yok — sabit UTC+3.
const TR_OFFSET_MS = 3 * 60 * 60 * 1000;

function parseMonth(month: string): { year: number; mon: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(month ?? "");
  if (!m) throw new Error(`Geçersiz ay biçimi (YYYY-MM bekleniyor): ${month}`);
  const year = Number(m[1]);
  const mon = Number(m[2]);
  if (mon < 1 || mon > 12) throw new Error(`Geçersiz ay: ${month}`);
  return { year, mon };
}

/** Ayın Türkiye saatiyle başlangıç ve bitiş anları (UTC instant olarak). */
export function monthRange(month: string): { start: Date; end: Date } {
  const { year, mon } = parseMonth(month);
  return {
    start: new Date(Date.UTC(year, mon - 1, 1) - TR_OFFSET_MS),
    end: new Date(Date.UTC(year, mon, 1) - TR_OFFSET_MS - 1),
  };
}

/** Verilen ana karşılık gelen ay, Türkiye saatine göre. */
export function currentMonth(now: Date): string {
  const tr = new Date(now.getTime() + TR_OFFSET_MS);
  return `${tr.getUTCFullYear()}-${String(tr.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function previousMonth(month: string): string {
  const { year, mon } = parseMonth(month);
  const d = new Date(Date.UTC(year, mon - 2, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** first..last aralığındaki ayları kapsayıcı olarak listeler. */
export function monthsBetween(first: string, last: string): string[] {
  const a = parseMonth(first);
  const b = parseMonth(last);
  const out: string[] = [];
  const cursor = new Date(Date.UTC(a.year, a.mon - 1, 1));
  const stop = new Date(Date.UTC(b.year, b.mon - 1, 1));
  while (cursor <= stop) {
    out.push(`${cursor.getUTCFullYear()}-${String(cursor.getUTCMonth() + 1).padStart(2, "0")}`);
    cursor.setUTCMonth(cursor.getUTCMonth() + 1);
  }
  return out;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

export function averageScore(rows: { score: number }[]): number | null {
  if (rows.length === 0) return null;
  return round2(rows.reduce((s, r) => s + r.score, 0) / rows.length);
}

export interface UpsellRateResult {
  value: number | null;
  presented: number;
  notPresented: number;
  na: number;
  unknown: number;
  perfectScoreOverrides: number;
}

/**
 * NA (bütçe kısıtı) ve BILINMIYOR (rapor satırı yok) paydadan tamamen düşer;
 * sayıları arayüzde ayrıca gösterilsin diye döndürülür.
 *
 * Kusursuz puan kuralı: skoru PERFECT_SCORE olan bir görüşmede saklanan
 * sınıflandırma ne olursa olsun upsell SUNULDU sayılır. Kural yalnızca burada,
 * toplama anında uygulanır — EvaluationUpsell satırı raporun gerçekte ne
 * dediğini tutmaya devam eder, böylece kural tek satırda geri alınabilir.
 * Kuralla pozitife çevrilen kayıt sayısı perfectScoreOverrides ile raporlanır.
 */
export function upsellRate(
  rows: { stemCell: UpsellStatus; premium: UpsellStatus; score: number }[],
  field: "stemCell" | "premium"
): UpsellRateResult {
  let presented = 0, notPresented = 0, na = 0, unknown = 0, perfectScoreOverrides = 0;
  for (const row of rows) {
    if (row.score >= PERFECT_SCORE) {
      presented++;
      if (row[field] !== "SUNULDU") perfectScoreOverrides++;
      continue;
    }
    switch (row[field]) {
      case "SUNULDU": presented++; break;
      case "SUNULMADI": notPresented++; break;
      case "NA": na++; break;
      case "BILINMIYOR": unknown++; break;
    }
  }
  const denom = presented + notPresented;
  return {
    value: denom === 0 ? null : round2((presented / denom) * 100),
    presented, notPresented, na, unknown, perfectScoreOverrides,
  };
}

export interface AgentAverage {
  id: string;
  name: string;
  avgScore: number | null;
  callCount: number;
}

/** Danışman başına ortalama skor. Skoru düşükten yükseğe sıralar. */
export function agentAverages(
  rows: { agentId: string; score: number }[],
  names: Map<string, string>
): AgentAverage[] {
  const acc = new Map<string, { sum: number; count: number }>();
  for (const r of rows) {
    const cur = acc.get(r.agentId) ?? { sum: 0, count: 0 };
    cur.sum += r.score;
    cur.count += 1;
    acc.set(r.agentId, cur);
  }
  return [...acc.entries()]
    .map(([id, v]) => ({
      id,
      name: names.get(id) ?? id,
      avgScore: round2(v.sum / v.count),
      callCount: v.count,
    }))
    .sort((a, b) => (a.avgScore ?? 0) - (b.avgScore ?? 0));
}

/** Seçili kişilerin ortalaması. O ay çağrısı olmayan kişi ortalamaya katılmaz. */
export function bottomSellersValue(selected: AgentAverage[]): number | null {
  const withData = selected.filter((s) => s.avgScore !== null && s.callCount > 0);
  if (withData.length === 0) return null;
  return round2(withData.reduce((s, a) => s + (a.avgScore as number), 0) / withData.length);
}

export type OkrStatus = "TAMAMLANDI" | "YOLUNDA" | "RISKLI" | "VERI_YOK";

export function okrStatus(value: number | null, target: number): OkrStatus {
  if (value === null) return "VERI_YOK";
  const ratio = value / target;
  if (ratio >= 1) return "TAMAMLANDI";
  if (ratio >= 0.95) return "YOLUNDA";
  return "RISKLI";
}
