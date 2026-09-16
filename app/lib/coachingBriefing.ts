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
