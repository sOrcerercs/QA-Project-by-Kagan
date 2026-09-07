// OKR panelinin tüm hesabı. DB ve AI erişimi yoktur; veriyi parametre alır.
// reportAggregation.ts ile aynı deseni izler.
import type { UpsellStatus, YesNo } from "@/app/lib/upsellClassify";

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

/** Ay seçicisinde "tüm aylar" için kullanılan özel değer. */
export const ALL_MONTHS = "ALL";

/** Sistemdeki en eski değerlendirme: 2026-05-18. Ay listesinin alt sınırı. */
export const FIRST_DATA_MONTH = "2026-05";

/**
 * Tek ay ya da ALL için tarih aralığı. ALL, ilk veri ayının başından son ayın
 * sonuna kadar tek bir aralığa iner — kümülatif değerler böylece havuzlanmış
 * (çağrı ağırlıklı) hesaplanır, aylık yüzdelerin ortalaması alınmaz.
 */
export function resolveRange(
  month: string,
  firstMonth: string,
  lastMonth: string
): { start: Date; end: Date } {
  if (month === ALL_MONTHS) {
    return { start: monthRange(firstMonth).start, end: monthRange(lastMonth).end };
  }
  return monthRange(month);
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

/** Çağrıları Türkiye saatine göre ay kovalarına dağıtır (giriş sırası korunur). */
export function groupByTrMonth<T extends { callDate: Date }>(rows: T[]): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const row of rows) {
    const key = currentMonth(row.callDate);
    const bucket = out.get(key);
    if (bucket) bucket.push(row);
    else out.set(key, [row]);
  }
  return out;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

/** Aylık değerlerin ortalaması; verisi olmayan ay (null) ortalamaya katılmaz. */
export function averageOfValues(values: (number | null)[]): number | null {
  const nums = values.filter((v): v is number => v !== null);
  if (nums.length === 0) return null;
  return round2(nums.reduce((s, v) => s + v, 0) / nums.length);
}

export type OkrCallType = "ALL" | "FIRST_CALL" | "SECOND_CALL";

const OKR_CALL_TYPES: readonly string[] = ["ALL", "FIRST_CALL", "SECOND_CALL"];

/**
 * Sorgu parametresini çağrı tipi filtresine çevirir; boş parametre = ALL.
 * app/lib/callTypeFilter.ts'teki parseCallTypeFilter geçersiz değeri sessizce
 * "Tümü" sayıyor; OKR panelinde bilerek hata fırlatıyoruz (route 400 döner) —
 * yanlış yazılmış bir filtre, farkında olunmadan tüm çağrıları kapsamasın.
 */
export function parseCallType(raw: string | null | undefined): OkrCallType {
  if (!raw) return "ALL";
  if (!OKR_CALL_TYPES.includes(raw)) throw new Error(`Geçersiz çağrı tipi: ${raw}`);
  return raw as OkrCallType;
}

/** "a, b ,a" → ["a","b"]. Boş parçalar atılır, tekrarlar teke iner. */
export function parseAgentIds(raw: string | null | undefined): string[] {
  if (!raw) return [];
  return [...new Set(raw.split(",").map((s) => s.trim()).filter(Boolean))];
}

/** Çağrı tipi + danışman filtrelerini bellekte uygular. */
export function filterEvaluations<T extends { agentId: string; callType: string }>(
  rows: T[],
  filter: { callType: OkrCallType; agentIds: string[] }
): T[] {
  const ids = filter.agentIds.length > 0 ? new Set(filter.agentIds) : null;
  return rows.filter(
    (r) =>
      (filter.callType === "ALL" || r.callType === filter.callType) &&
      (ids === null || ids.has(r.agentId))
  );
}

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
  /** Premium anlatıldığı için Stem Cell paydadan düşen kayıt sayısı. */
  premiumCoverExclusions: number;
  /** Müşterinin bütçe kısıtı nedeniyle cezası kaldırılan kayıt sayısı. */
  budgetExclusions: number;
  /** Müşteri net paket tercihi belirttiği için cezası kaldırılan kayıt sayısı. */
  fixedChoiceExclusions: number;
}

/** Kuralların üzerinde çalıştığı asgari satır. */
export interface UpsellRow {
  stemCell: UpsellStatus;
  premium: UpsellStatus;
  score: number;
  /** Artık hiçbir kural okumuyor; bkz. upsellClassify.ts UpsellVerdict. */
  customerChosePremium?: YesNo | null;
  budgetConstraint?: YesNo | null;
  /** Müşteri belirli bir paketi net olarak tercih ettiğini beyan etti mi? */
  customerFixedChoice?: YesNo | null;
}

/** Cezayı kaldıran kuralın kimliği; arayüzde her biri ayrı sayılıyor. */
export type UpsellExemption = "budget" | "fixedChoice" | "premiumCover";

/**
 * Kaydın cezasını kaldıran kural — yoksa null.
 *
 * Üç muafiyet, üçü de YALNIZCA cezayı kaldırır: sunulduysa hiçbir şey
 * değişmez, çünkü çabayı cezalandırmamak asıl amaç. Sıra önemlidir, çünkü bir
 * kayıtta birden fazlası birleşebilir ve arayüz "hangi kural yüzünden" diye
 * sayıyor:
 *
 * 1. Bütçe kısıtı: müşteri parasının yetmediğini söylediyse ne Stem Cell ne
 *    Premium beklenir; satışın kendisi önceliklidir. İkisi de NA olur.
 * 2. Net paket tercihi (2026-08-27): müşteri belirli bir paketi tercih
 *    ettiğini net olarak beyan ettiyse üstünü satmak için ısrarcı olunmaz.
 *    İkisi de NA olur. DİKKAT: raporun "yalnızca temel paket anlatıldı"
 *    demesi bu değildir — o danışmanın kapsamı, müşterinin beyanı değil; ayrım
 *    sınıflandırıcı prompt'unda anlam düzeyinde yapılıyor.
 * 3. Premium kapsaması: Premium paketin içinde Stem Cell zaten var. Danışman
 *    Premium'u anlattıysa Advanced'i ayrıca anlatmaması eksiklik değil —
 *    Stem Cell NA olur. (Müşterinin Premium'u seçmiş olması ARANMAZ;
 *    2026-08-15'te kullanıcı koşulu buraya gevşetti.)
 *
 * Kurallar yalnızca toplama anında uygulanır; EvaluationUpsell satırı raporun
 * ne dediğini tutmaya devam eder ve kural tek fonksiyonda geri alınabilir
 * (kusursuz puan kuralıyla aynı yaklaşım, bkz. upsellRate).
 */
export function upsellExemption(
  row: UpsellRow,
  field: "stemCell" | "premium"
): UpsellExemption | null {
  if (row[field] !== "SUNULMADI") return null;
  if (row.budgetConstraint === "EVET") return "budget";
  if (row.customerFixedChoice === "EVET") return "fixedChoice";
  if (field === "stemCell" && row.premium === "SUNULDU") return "premiumCover";
  return null;
}

/**
 * Kayıtta saklanan sınıflandırmanın metriğe yansıyan hali. Muafiyet listesi ve
 * sırası tek yerde, upsellExemption'da durur — sayaçlar da oradan okunur ki
 * "hangi kural devreye girdi" cevabı iki yerde ayrışmasın.
 */
export function effectiveStatus(row: UpsellRow, field: "stemCell" | "premium"): UpsellStatus {
  return upsellExemption(row, field) ? "NA" : row[field];
}

/**
 * NA pozitif sayılır, BILINMIYOR (rapor satırı yok) paydadan tamamen düşer;
 * ikisinin de sayısı arayüzde ayrıca gösterilsin diye döndürülür.
 *
 * Kusursuz puan kuralı: skoru PERFECT_SCORE olan bir görüşmede saklanan
 * sınıflandırma ne olursa olsun upsell SUNULDU sayılır. Kural yalnızca burada,
 * toplama anında uygulanır — EvaluationUpsell satırı raporun gerçekte ne
 * dediğini tutmaya devam eder, böylece kural tek satırda geri alınabilir.
 * Kuralla pozitife çevrilen kayıt sayısı perfectScoreOverrides ile raporlanır.
 */
export function upsellRate(
  rows: UpsellRow[],
  field: "stemCell" | "premium"
): UpsellRateResult {
  let presented = 0, notPresented = 0, na = 0, unknown = 0, perfectScoreOverrides = 0;
  let premiumCoverExclusions = 0, budgetExclusions = 0, fixedChoiceExclusions = 0;
  for (const row of rows) {
    if (row.score >= PERFECT_SCORE) {
      presented++;
      if (row[field] !== "SUNULDU") perfectScoreOverrides++;
      continue;
    }
    // Hangi muafiyetin devreye girdiği arayüzde ayrı ayrı gösteriliyor; kararın
    // kendisi de aynı yerden geliyor ki sayaç ile statü ayrışamasın.
    const exemption = upsellExemption(row, field);
    if (exemption === "budget") budgetExclusions++;
    else if (exemption === "fixedChoice") fixedChoiceExclusions++;
    else if (exemption === "premiumCover") premiumCoverExclusions++;
    const status: UpsellStatus = exemption ? "NA" : row[field];
    switch (status) {
      case "SUNULDU": presented++; break;
      case "SUNULMADI": notPresented++; break;
      // NA POZİTİF sayılır (2026-08-16, kullanıcı kararı): bu çağrılarda B8/B9
      // maddesi zaten kırılmadı, dolayısıyla danışman puan kaybetmedi. Paydadan
      // düşürmek yerine başarı hanesine yazılıyorlar. `na` sayacı yine de
      // tutuluyor ki arayüz kaç kaydın bu yolla pozitife geçtiğini gösterebilsin.
      case "NA": presented++; na++; break;
      // BILINMIYOR farklı: raporda "Upsell Durumu" satırı hiç yok, yani karar
      // verecek veri yok. Ne pozitif ne negatif — paydadan tamamen düşer.
      case "BILINMIYOR": unknown++; break;
    }
  }
  const denom = presented + notPresented;
  return {
    value: denom === 0 ? null : round2((presented / denom) * 100),
    presented, notPresented, na, unknown, perfectScoreOverrides,
    premiumCoverExclusions, budgetExclusions, fixedChoiceExclusions,
  };
}

/** Eksiklik listesinde hangi pakete odaklanıldığı. */
export type UpsellFocus = "ALL" | "stemCell" | "premium";

/**
 * Tanıtımın yapılmadığı çağrılar: yalnızca SUNULMADI eksiklik sayılır.
 * NA (görüşme fiyata gelmemiş) ve BILINMIYOR (rapor satırı yok) eksiklik
 * değil — zaten upsellRate'te de paydadan düşüyorlar.
 *
 * Skoru PERFECT_SCORE olanlar listeye girmez: upsellRate onları "sunuldu"
 * sayıyor, listede "eksik" diye görünmeleri kartla çelişirdi.
 *
 * Hem sunucuda (tüm eksikler) hem arayüzde (paket odağı) aynı fonksiyon
 * kullanılıyor ki iki taraf ayrışmasın.
 */
export function upsellGaps<T extends UpsellRow>(rows: T[], focus: UpsellFocus): T[] {
  return rows.filter((r) => {
    if (r.score >= PERFECT_SCORE) return false;
    // Muafiyetler burada da uygulanır — kart ile liste ayrışmasın
    // (bkz. effectiveStatus).
    const stemCell = effectiveStatus(r, "stemCell");
    const premium = effectiveStatus(r, "premium");
    if (focus === "ALL") return stemCell === "SUNULMADI" || premium === "SUNULMADI";
    if (focus === "stemCell") return stemCell === "SUNULMADI";
    return premium === "SUNULMADI";
  });
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
