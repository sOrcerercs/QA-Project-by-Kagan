/**
 * Haftalık Koçluk Brifingi'nin seçim motoru.
 *
 * TASARIM KURALI — bozma:
 * Bu dosya SAF'tır. Prisma import etmez, fetch yapmaz, Date.now() okumaz,
 * kullanıcıya görünen METİN üretmez. Yalnızca "hangi çağrı, hangi gerekçe
 * koduyla" sorusunu cevaplar. Metin app/lib/coachingBriefingText.ts'te,
 * veri toplama route'ta.
 *
 * Kanıtlar reportData'dan DOĞRUDAN okunmaz; buildReportCard() üzerinden
 * okunur. Böylece prompt değişip blok şekli kaydığında brifing de kartla
 * birlikte kendiliğinden uyar — bkz. sdr-wiki/decisions/
 * kart-prompta-gore-uyum-saglasin.md
 */

import { buildReportCard } from "./reportCard";
import type { Lang } from "./i18n";

export type ReasonCode =
  | "RECURRING_WEAKNESS"
  | "BIGGEST_LOSS"
  | "STANDOUT_UP"
  | "STANDOUT_DOWN"
  | "GOOD_EXAMPLE"
  | "ONLY_CALL";

/** Seçim için gereken en dar değerlendirme görünümü. */
export interface BriefingEval {
  id: string;
  customerName: string;
  /** ISO 8601 string. */
  callDate: string;
  score: number;
  /** Evaluation.weakCriteria kolonu, ham. */
  weakCriteria: unknown;
  /** Evaluation.reportData kolonu, ham. */
  reportData: unknown;
  /** TL bu çağrı için koçluk yaptı mı — kartta işaretli görünsün diye taşınır. */
  coachingDone: boolean;
}

/** Gerekçe metnini besleyen sayılar. Hangi alanın dolduğu ReasonCode'a bağlı. */
export interface ReasonData {
  criterionId?: string;
  criterionLabel?: string;
  /** Kriterin geçmiş penceresinde kaç çağrıda zayıf kaldığı. */
  occurrences?: number;
  /** Geçmiş penceresinin hafta cinsinden uzunluğu. */
  windowWeeks?: number;
  /** Puan kaybı. */
  loss?: number;
  /** Danışmanın kendi ortalamasından sapma (işaretli). */
  deviation?: number;
  average?: number;
  /** ONLY_CALL için: o hafta toplam kaç çağrı var. */
  callCount?: number;
}

export interface Candidate {
  evaluationId: string;
  reason: ReasonCode;
  reasonData: ReasonData;
}

/**
 * Bir çağrıda kaybedilen puan — YÜZDE olarak.
 *
 * Blok varsa kayıp `card.points` üzerinden hesaplanır (`(max − earned) / max`),
 * blok yoksa `100 − score`'a düşülür — 3 Eylül 2026 öncesi kayıtlarda blok yok,
 * bu yol onlar için gerekli.
 *
 * Blok puanı HAM rubrik ölçeğinde (ör. 18 üzerinden), yedek yol ise yüzde.
 * `selectBiggestLoss` ikisini tek listede sıraladığı için ikisi de yüzdeye
 * çevrilir; yoksa bloksuz kayıtlar her zaman kazanır ve "en büyük kayıp"
 * satırı sistematik olarak kanıtsız çıkar. Prod'da ölçüldü (son 28 gün,
 * 1132 kayıt): yedek/blok medyan oranı 3.2x.
 */
export function evaluationLoss(e: BriefingEval): number {
  const card = buildReportCard({ reportData: e.reportData, weakCriteria: e.weakCriteria });
  if (card.points && card.points.max > 0) {
    const { earned, max } = card.points;
    return Math.max(0, Math.round(((max - earned) / max) * 1000) / 10);
  }
  return Math.max(0, 100 - e.score);
}

/**
 * Puanlanamayan çağrı (telesekreter, yanlış numara) koçluk konusu değildir.
 *
 * reportJson.ts böyle bir çağrıyı `score: 0` ve kriteri olmayan blokla
 * kaydediyor. Elenmezse brifingde iki negatif seçiciyi birden kazanır
 * (kayıp 100, sapma ≈ −75) ve kanıtsız gelir; üstelik 4 haftalık ortalamayı
 * aşağı çekip herkesin sapmasını kaydırır. Prod'da %1.4 (1132'de 16).
 */
export function isScorable(e: BriefingEval): boolean {
  return buildReportCard({ reportData: e.reportData, weakCriteria: e.weakCriteria }).scorable;
}

/** Bir kriterin "tekrar ediyor" sayılması için gereken en az çağrı sayısı. */
export const RECURRENCE_MIN_OCCURRENCES = 2;

interface WeakRow {
  id: string;
  label: string;
  score: number;
}

/** weakCriteria kolonunu tolere ederek satırlara çevirir. Bozuk giriş → []. */
function weakRows(raw: unknown): WeakRow[] {
  if (!Array.isArray(raw)) return [];
  const out: WeakRow[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const d = r as Record<string, unknown>;
    const id = typeof d.id === "string" ? d.id : null;
    if (!id) continue;
    out.push({
      id,
      label: typeof d.label === "string" ? d.label : id,
      score: typeof d.score === "number" ? d.score : 0,
    });
  }
  return out;
}

/**
 * Geçmiş penceresinde en sık zayıf kalan kriteri bulur, o kriterin bu hafta
 * en dibe vurduğu çağrıları sıralar.
 *
 * Beraberlik: önce tekrar sayısı, sonra ortalama kriter skoru (düşük kazanır),
 * sonra id alfabetik. Sıralama belirlenimci olmalı, yoksa aynı veri iki farklı
 * brifing üretir.
 */
export function selectRecurringWeakness(
  week: BriefingEval[],
  history: BriefingEval[],
  windowWeeks: number
): Candidate[] {
  const stats = new Map<string, { label: string; count: number; total: number }>();
  for (const e of history) {
    for (const row of weakRows(e.weakCriteria)) {
      const s = stats.get(row.id) ?? { label: row.label, count: 0, total: 0 };
      s.count += 1;
      s.total += row.score;
      stats.set(row.id, s);
    }
  }

  const ranked = [...stats.entries()]
    .filter(([, s]) => s.count >= RECURRENCE_MIN_OCCURRENCES)
    .sort((a, b) => {
      if (b[1].count !== a[1].count) return b[1].count - a[1].count;
      const avgA = a[1].total / a[1].count;
      const avgB = b[1].total / b[1].count;
      if (avgA !== avgB) return avgA - avgB;
      return a[0] < b[0] ? -1 : 1;
    });

  if (ranked.length === 0) return [];
  const [criterionId, stat] = ranked[0];

  return week
    .map((e) => {
      const row = weakRows(e.weakCriteria).find((r) => r.id === criterionId);
      return row ? { e, row } : null;
    })
    .filter((x): x is { e: BriefingEval; row: WeakRow } => x !== null)
    .sort((a, b) => (a.row.score !== b.row.score ? a.row.score - b.row.score : a.e.id < b.e.id ? -1 : 1))
    .map(({ e, row }) => ({
      evaluationId: e.id,
      reason: "RECURRING_WEAKNESS" as const,
      reasonData: {
        criterionId,
        criterionLabel: row.label || stat.label,
        occurrences: stat.count,
        windowWeeks,
      },
    }));
}

/** Haftanın en çok puan kaybedilen çağrılarını sıralar. Kayıpsızlar elenir. */
export function selectBiggestLoss(week: BriefingEval[]): Candidate[] {
  return week
    .map((e) => ({ e, loss: evaluationLoss(e) }))
    .filter(({ loss }) => loss > 0)
    // Beraberlik id ile çözülür — sıralama toplam olmalı.
    .sort((a, b) => (b.loss !== a.loss ? b.loss - a.loss : a.e.id < b.e.id ? -1 : 1))
    .map(({ e, loss }) => ({
      evaluationId: e.id,
      reason: "BIGGEST_LOSS" as const,
      reasonData: { loss: Math.round(loss * 100) / 100 },
    }));
}

/** Ortalamaya güvenmek için geçmişte gereken en az değerlendirme sayısı. */
export const STANDOUT_MIN_HISTORY = 3;
/** Sapmanın konuşmaya değer sayılması için gereken en az puan farkı. */
export const STANDOUT_MIN_DEVIATION = 5;

/**
 * Danışmanın kendi 4 haftalık ortalamasından en çok sapan çağrıları sıralar.
 * İki yönlü: yukarı sapma "burada ne farklı yaptı", aşağı sapma "burada ne oldu".
 */
export function selectStandout(week: BriefingEval[], history: BriefingEval[]): Candidate[] {
  if (history.length < STANDOUT_MIN_HISTORY) return [];
  const average = history.reduce((s, e) => s + e.score, 0) / history.length;

  return week
    .map((e) => ({ e, deviation: e.score - average }))
    .filter(({ deviation }) => Math.abs(deviation) >= STANDOUT_MIN_DEVIATION)
    // Beraberlik id ile çözülür — sıralama toplam olmalı.
    .sort((a, b) =>
      Math.abs(b.deviation) !== Math.abs(a.deviation)
        ? Math.abs(b.deviation) - Math.abs(a.deviation)
        : a.e.id < b.e.id ? -1 : 1
    )
    .map(({ e, deviation }) => ({
      evaluationId: e.id,
      reason: (deviation > 0 ? "STANDOUT_UP" : "STANDOUT_DOWN") as ReasonCode,
      reasonData: {
        deviation: Math.round(deviation * 10) / 10,
        average: Math.round(average * 10) / 10,
      },
    }));
}

/** Bir seçimde gösterilen en fazla kanıt sayısı. Kart zaten tamamını taşıyor. */
export const MAX_EVIDENCE = 2;

export interface BriefingEvidence {
  speakerLabel: string | null;
  ts: string | null;
  text: string;
}

export interface PickDetail {
  evidence: BriefingEvidence[];
  shouldHaveSaid: string | null;
  criterionLabel: string | null;
}

const POSITIVE_REASONS: ReasonCode[] = ["GOOD_EXAMPLE", "STANDOUT_UP"];

/** Gerekçenin pozitif olup olmadığı. Kanıtın hangi listeden geleceğini belirler. */
export function isPositiveReason(reason: ReasonCode): boolean {
  return POSITIVE_REASONS.includes(reason);
}

const EMPTY: PickDetail = { evidence: [], shouldHaveSaid: null, criterionLabel: null };

function toEvidence(list: { speakerLabel: string | null; ts: string | null; text: string }[]): BriefingEvidence[] {
  return list
    .filter((x) => x.text.trim() !== "")
    .slice(0, MAX_EVIDENCE)
    .map((x) => ({ speakerLabel: x.speakerLabel, ts: x.ts, text: x.text }));
}

/**
 * Seçilen çağrıdan gerekçeye uygun kanıtı çıkarır.
 *
 * Pozitif gerekçelerde kanıt "doğru yapılanlar" listesinden, negatiflerde
 * kırık maddeden gelir. RECURRING_WEAKNESS aranan kriteri bulamazsa en çok
 * puan kaybettiren maddeye düşer — blok değişmiş ya da eski kayıt olabilir.
 */
export function pickEvidence(
  e: BriefingEval,
  reason: ReasonCode,
  reasonData: ReasonData,
  lang: Lang = "tr"
): PickDetail {
  // Kartın "<alan>En" alanları yalnızca lang="en" geçildiğinde okunuyor;
  // criterionLabel ve shouldHaveSaid İngilizce kullanıcıya bu yolla ulaşıyor.
  // Alıntılar dile duyarlı DEĞİL — tasarım gereği hep orijinal dilinde kalır.
  const card = buildReportCard({ reportData: e.reportData, weakCriteria: e.weakCriteria, lang });

  if (isPositiveReason(reason)) {
    const best = card.passed.find((p) => p.evidence.length > 0) ?? card.passed[0];
    if (!best) return EMPTY;
    return { evidence: toEvidence(best.evidence), shouldHaveSaid: null, criterionLabel: best.label };
  }

  const byId = reasonData.criterionId
    ? card.faults.find((f) => f.id === reasonData.criterionId)
    : undefined;
  // buildReportCard faults'u zaten belirlenimci sıralı veriyor: kayıp azalan,
  // kaybı bilinmeyenler sonda ve aralarında altScore ARTAN (en kötü kriter
  // önce), sonra id. Burada yeniden sıralamak null kaybı 0'a çekip id
  // alfabetiğine düşürüyordu; eski kayıtlarda (her fault loss: null) brifing
  // bu yüzden en kötü kriteri değil alfabetik ilkini etiketliyordu.
  const fault = byId ?? card.faults[0];
  if (!fault) return EMPTY;

  return {
    evidence: toEvidence(fault.evidence),
    shouldHaveSaid: fault.shouldHaveSaid,
    criterionLabel: fault.label,
  };
}

/** Üç seçiciden alınan en fazla satır. Pozitif garantisi bunun üstüne 1 ekleyebilir. */
export const MAX_SELECTOR_PICKS = 3;

export interface BriefingPick {
  evaluationId: string;
  customerName: string;
  callDate: string;
  score: number;
  reason: ReasonCode;
  reasonData: ReasonData;
  evidence: BriefingEvidence[];
  shouldHaveSaid: string | null;
  criterionLabel: string | null;
  coachingDone: boolean;
}

export interface AgentBriefing {
  agentId: string;
  agentName: string;
  callCount: number;
  /** Haftanın ortalaması; çağrı yoksa null. */
  averageScore: number | null;
  picks: BriefingPick[];
}

export interface BuildBriefingInput {
  agentId: string;
  agentName: string;
  /** Brifing haftasındaki değerlendirmeler. */
  week: BriefingEval[];
  /** Geçmiş pencere — brifing haftası DAHİL (spec: 4 hafta). */
  history: BriefingEval[];
  windowWeeks: number;
  /** Kanıt/etiket metinlerinin dili. Seçim mantığı dilden etkilenmez. */
  lang?: Lang;
}

/**
 * Bir danışmanın haftalık brifingini kurar.
 *
 * Sıra: tekrar eden zayıflık → en büyük kayıp → sapma. Her seçiciden
 * kullanılmamış ilk aday alınır; en fazla MAX_SELECTOR_PICKS satır.
 * Sonra pozitif garantisi: listede hiç pozitif yoksa bir tane eklenir.
 * Son olarak, danışmanın o hafta MAX_SELECTOR_PICKS'ten az çağrısı varsa
 * geri kalanlar ONLY_CALL olarak eklenir — az çağrılı danışman boş ekran
 * görmemeli (bkz. spec, "Az çağrı hâli").
 */
export function buildBriefing(input: BuildBriefingInput): AgentBriefing {
  const { agentId, agentName, windowWeeks, lang = "tr" } = input;

  // Puanlanamayan çağrılar en başta elenir: seçicilere, çağrı sayısına,
  // ortalamaya ve geçmiş penceresine hiç girmezler. Tek yerde elemek
  // seçicilerin her birine ayrı koşul eklemekten daha güvenli.
  const week = input.week.filter(isScorable);
  const history = input.history.filter(isScorable);

  const base = {
    agentId,
    agentName,
    callCount: week.length,
    averageScore: week.length === 0
      ? null
      : Math.round(week.reduce((s, e) => s + e.score, 0) / week.length),
  };
  if (week.length === 0) return { ...base, picks: [] };

  const byId = new Map(week.map((e) => [e.id, e]));
  const used = new Set<string>();
  const chosen: Candidate[] = [];

  const selectors: Candidate[][] = [
    selectRecurringWeakness(week, history, windowWeeks),
    selectBiggestLoss(week),
    selectStandout(week, history),
  ];
  for (const ranked of selectors) {
    if (chosen.length >= MAX_SELECTOR_PICKS) break;
    const next = ranked.find((c) => !used.has(c.evaluationId));
    if (!next) continue;
    used.add(next.evaluationId);
    chosen.push(next);
  }

  // Pozitif garantisi: 1-1 sadece hata toplantısı olmasın.
  if (!chosen.some((c) => isPositiveReason(c.reason))) {
    const candidate = week
      .filter((e) => !used.has(e.id))
      .map((e) => ({ e, detail: pickEvidence(e, "GOOD_EXAMPLE", {}, lang) }))
      .filter(({ detail }) => detail.evidence.length > 0)
      // Beraberlik id ile çözülür — hangi çağrının iyi örnek olacağı karar.
      .sort((a, b) => (b.e.score !== a.e.score ? b.e.score - a.e.score : a.e.id < b.e.id ? -1 : 1))[0];
    if (candidate) {
      used.add(candidate.e.id);
      chosen.push({ evaluationId: candidate.e.id, reason: "GOOD_EXAMPLE", reasonData: {} });
    }
  }

  // Az çağrı hâli: 3'ten az çağrısı olan danışmanda kalanlar da listelensin.
  // Çok çağrılı danışmanda bu adım hiç çalışmaz — seçim zaten anlamlı.
  if (week.length <= MAX_SELECTOR_PICKS) {
    for (const e of week) {
      if (used.has(e.id)) continue;
      used.add(e.id);
      chosen.push({ evaluationId: e.id, reason: "ONLY_CALL", reasonData: { callCount: week.length } });
    }
  }

  const picks: BriefingPick[] = chosen.map((c) => {
    const e = byId.get(c.evaluationId)!;
    const detail = pickEvidence(e, c.reason, c.reasonData, lang);
    return {
      evaluationId: e.id,
      customerName: e.customerName,
      callDate: e.callDate,
      score: e.score,
      reason: c.reason,
      reasonData: c.reasonData,
      evidence: detail.evidence,
      shouldHaveSaid: detail.shouldHaveSaid,
      criterionLabel: detail.criterionLabel,
      coachingDone: e.coachingDone,
    };
  });

  return { ...base, picks };
}
