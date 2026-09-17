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
 * Bir danışmanın geçmiş penceresindeki kriter istatistiği.
 *
 * NEDEN ÖNCEDEN HESAPLANMIŞ GELİYOR: eskiden bu sayım geçmişin tüm
 * `weakCriteria` kolonları çekilerek bellekte yapılıyordu. Ölçüldü: 1149
 * satırın `weakCriteria`'sı 18 sn, aynı satırların skalerleri 0.6 sn. Sayım
 * SQL'e taşındı (route, jsonb_array_elements); bu modül saf kalsın diye
 * sonucu parametre olarak alıyor.
 */
export interface CriterionStat {
  criterionId: string;
  label: string;
  occurrences: number;
  /** Kriterin pencere boyunca ortalama skoru; beraberlik çözümünde kullanılır. */
  avgScore: number;
}

/**
 * Bir çağrıda kaybedilen puan — 0-100 ölçeğinde.
 *
 * ÖLÇÜLDÜ (prod, son 14 gün, points hesaplanabilen 353 kayıt): bloktan
 * türetilen `(max−earned)/max*100` ile `100 − score` kayıtların %98.3'ünde
 * yuvarlama farkı içinde AYNI (medyan fark 0.25, p90 0.50). Ayrışan 6 kaydın
 * hepsi skor 100 olanlar; orada blok yolu %15-28 kayıp gösteriyor (N/A
 * maddelerini kayıp sayarak), `100 − score` ise 0 diyor. Kusursuz bir çağrıda
 * doğru cevap 0 — yani basit yol aynı zamanda DAHA doğru.
 *
 * Mimari sonucu: kayıp sıralaması reportData GEREKTİRMEZ. Bu yüzden uç,
 * haftanın tüm çağrıları yerine yalnızca SEÇİLEN çağrılar için blok çeker.
 * Blok çekmek pahalı — prod'da 1149 satırın reportData'sı 68 sn, aynı
 * satırların skalerleri 0.6 sn.
 */
export function evaluationLoss(e: BriefingEval): number {
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
  history: CriterionStat[],
  windowWeeks: number
): Candidate[] {
  const ranked = history
    .filter((s) => s.occurrences >= RECURRENCE_MIN_OCCURRENCES)
    .slice()
    .sort((a, b) => {
      if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
      if (a.avgScore !== b.avgScore) return a.avgScore - b.avgScore;
      return a.criterionId < b.criterionId ? -1 : 1;
    });

  if (ranked.length === 0) return [];
  const stat = ranked[0];
  const criterionId = stat.criterionId;

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
        occurrences: stat.occurrences,
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
export function selectStandout(week: BriefingEval[], historyScores: number[]): Candidate[] {
  if (historyScores.length < STANDOUT_MIN_HISTORY) return [];
  const average = historyScores.reduce((s, n) => s + n, 0) / historyScores.length;

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

/**
 * Danışmanın o haftaki çağrılarının HEPSİNİN listelendiği üst sınır (dahil).
 *
 * Bugün seçim tavanıyla aynı sayı, ama AYRI bir ürün kuralı: tavan 4'e
 * çekilseydi az-çağrı eşiğinin de kaymasını kimse istemezdi. Ayrı sabit,
 * ayrı karar.
 */
export const LOW_VOLUME_MAX_CALLS = MAX_SELECTOR_PICKS;

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
  /** Geçmiş penceredeki kriter istatistikleri (SQL'de hesaplanır). */
  history: CriterionStat[];
  /** Geçmiş penceredeki skorlar — sapma ortalaması için; yalnızca sayı. */
  historyScores: number[];
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
 * Son olarak, danışmanın o hafta LOW_VOLUME_MAX_CALLS ya da daha az çağrısı
 * varsa geri kalanlar ONLY_CALL olarak eklenir — az çağrılı danışman boş
 * ekran görmemeli (bkz. spec, "Az çağrı hâli").
 */
export function buildBriefing(input: BuildBriefingInput): AgentBriefing {
  const { agentId, agentName, windowWeeks, lang = "tr" } = input;

  // Puanlanamayan çağrılar (telesekreter, yanlış numara) buraya HİÇ gelmez:
  // eleme SQL'de yapılıyor (route: reportData->>'scorable' predicate'i).
  // Burada elemek blok okumayı gerektirirdi; bkz. evaluationLoss yorumu.
  const week = input.week;
  const { history, historyScores } = input;

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
    selectStandout(week, historyScores),
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

  // Az çağrı hâli: 3 ya da daha az çağrısı olan danışmanda kalanlar da
  // listelensin. Çok çağrılı danışmanda bu adım hiç çalışmaz — seçim zaten
  // anlamlı.
  if (week.length <= LOW_VOLUME_MAX_CALLS) {
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

/**
 * Seçilen satırlara kanıtı sonradan ekler.
 *
 * NEDEN AYRI ADIM: kanıt `reportData` ister ve blok çekmek pahalı — prod'da
 * 1149 satırın reportData'sı 68 sn, skalerleri 0.6 sn. Seçim artık blok
 * gerektirmediği için (bkz. evaluationLoss) uç önce ucuz veriyle SEÇİYOR,
 * sonra yalnızca seçilen ~4 satırın bloğunu çekip burada dolduruyor.
 *
 * Bloğu bulunamayan satır sessizce kanıtsız kalır — kart bunu zaten
 * gösterebiliyor; eksik blok yüzünden tüm brifingi düşürmek yanlış olurdu.
 */
export function enrichPicks(
  briefings: AgentBriefing[],
  detailsById: Map<string, { reportData: unknown; weakCriteria: unknown }>,
  lang: Lang = "tr",
): AgentBriefing[] {
  return briefings.map((b) => ({
    ...b,
    picks: b.picks.map((p) => {
      const d = detailsById.get(p.evaluationId);
      if (!d) return p;
      const detail = pickEvidence(
        { ...emptyEval(p.evaluationId), reportData: d.reportData, weakCriteria: d.weakCriteria },
        p.reason,
        p.reasonData,
        lang,
      );
      return {
        ...p,
        evidence: detail.evidence,
        shouldHaveSaid: detail.shouldHaveSaid,
        criterionLabel: detail.criterionLabel,
      };
    }),
  }));
}

/** pickEvidence yalnızca blok alanlarını okur; kalanlar için nötr iskelet. */
function emptyEval(id: string): BriefingEval {
  return {
    id,
    customerName: "",
    callDate: "",
    score: 0,
    weakCriteria: null,
    reportData: null,
    coachingDone: false,
  };
}
