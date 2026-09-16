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
 * Bir çağrıda kaybedilen puan.
 *
 * Önce bloktaki kriter kayıpları toplanır (buildReportCard `loss` alanını
 * blokta varsa oradan, yoksa `max - earned`'dan türetiyor). Blok yoksa ya da
 * hiçbir kırık madde okunamıyorsa `100 - score`'a düşülür — 3 Eylül 2026
 * öncesi kayıtlarda blok yok, bu yol onlar için gerekli.
 */
export function evaluationLoss(e: BriefingEval): number {
  const card = buildReportCard({ reportData: e.reportData, weakCriteria: e.weakCriteria });
  const losses = card.faults.map((f) => f.loss).filter((l): l is number => typeof l === "number");
  if (losses.length > 0) return losses.reduce((s, l) => s + l, 0);
  return Math.max(0, 100 - e.score);
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
    .sort((a, b) => a.row.score - b.row.score)
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
