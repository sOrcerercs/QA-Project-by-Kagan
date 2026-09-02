/**
 * Değerlendirme kartının veri katmanı.
 *
 * TASARIM KURALI — bozma:
 * Bu dosyada kriter listesi, kriter adı, ağırlık, bölüm adı veya skor bandı
 * SABİTLENMEZ. Hepsi promptun ürettiği JSON bloğundan okunur. Prompta yeni bir
 * kriter eklemek, bir kriteri yeniden adlandırmak, ağırlığını değiştirmek,
 * bölüm eklemek veya bant eşiklerini değiştirmek KOD DEĞİŞİKLİĞİ GEREKTİRMEZ.
 *
 * Kodun sabitlediği tek şey alan adları (zarf sözleşmesi) — o da takma adlara
 * toleranslı: passedCriteria/passed, weight/max, subChecks/subs,
 * timestamp/ts hepsi kabul edilir. Tanınmayan alanlar sessizce yok sayılır,
 * asla hata vermez.
 *
 * İki dillilik: bir alanın "<alan>En" karşılığı varsa İngilizce görünümde o
 * kullanılır (promptun verdiği hazır çeviri, canlı çeviri çağrısı gerekmez).
 * Yoksa çeviri servisine düşer (bkz. reportDataI18n.ts).
 */

/* ────────────────────────── görünüm modeli (çıktı) ─────────────────────── */

export type Severity = "broken" | "partial";

export interface Evidence {
  speaker: "agent" | "customer" | "other";
  speakerLabel: string | null;
  text: string;
  ts: string | null;
  highlights: string[];
  note: string | null;
}

export interface Sub {
  label: string;
  ok: boolean;
}

export interface PassedItem {
  id: string;
  label: string;
  earned: number | null;
  max: number | null;
  summary: string | null;
  subs: Sub[];
  evidence: Evidence[];
}

export interface FaultItem {
  id: string;
  label: string;
  severity: Severity;
  /** Kaybedilen puan. Blokta loss varsa o, yoksa max − earned. */
  loss: number | null;
  /** 0-100 kriter skoru — kayıp hesaplanamadığında gösterilir. */
  altScore: number | null;
  whatHappened: string | null;
  note: string | null;
  shouldHaveSaid: string | null;
  subs: Sub[];
  evidence: Evidence[];
}

export interface NaItem {
  id: string;
  label: string;
  reason: string | null;
}

export interface FlagItem {
  title: string;
  qualifier: string | null;
  detail: string | null;
  /** 18 yaş altı gibi insan incelemesi gerektiren durum — kartta kırmızı. */
  escalation: boolean;
}

export interface CoachingItem {
  title: string;
  detail: string | null;
  source: string | null;
}

export interface SectionMeter {
  key: string;
  label: string | null;
  score: number;
}

export interface Tally {
  passed: number;
  partial: number;
  broken: number;
  na: number;
}

export interface ReportCard {
  /** Blokta band varsa o; yoksa null — bileşen skordan türetir. */
  band: string | null;
  /** Arama puanlanabilir mi (telesekreter, yanlış numara vb. → false). */
  scorable: boolean;
  /** Ağır ihlal — skor sıfırlanmış olabilir, bölüm skorları korunur. */
  hardFail: boolean;
  /** Puanlanamayan aramalarda sebebi (callClassification). */
  classification: string | null;
  points: { earned: number; max: number } | null;
  sections: SectionMeter[];
  passed: PassedItem[];
  faults: FaultItem[];
  na: NaItem[];
  flags: FlagItem[];
  coaching: CoachingItem[];
  tally: Tally;
  isEmpty: boolean;
  /** Kanıt ve "doğru yapılanlar" taşımayan dar veriden türetildiyse true. */
  isSparse: boolean;
}

/* ────────────────────────────── yardımcılar ─────────────────────────────── */

type Dict = Record<string, unknown>;

function isDict(v: unknown): v is Dict {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function arr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function num(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  // Prompt sayıyı string yollarsa ("3.0") yine kabul et.
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v.replace(",", "."));
    if (Number.isFinite(n)) return n;
  }
  return null;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/**
 * Bir alanı takma adlarıyla, dile duyarlı okur. lang="en" ise önce "<alan>En"
 * denenir — prompt hazır çeviri verdiyse canlı çeviriye hiç gerek kalmaz.
 */
function text(obj: Dict, lang: "tr" | "en", ...keys: string[]): string | null {
  const tryKeys = lang === "en" ? keys.flatMap((k) => [k + "En", k]) : keys;
  for (const k of tryKeys) {
    const v = obj[k];
    if (typeof v === "string" && v.trim().length > 0) return v.trim();
  }
  return null;
}

function firstNum(obj: Dict, ...keys: string[]): number | null {
  for (const k of keys) {
    const n = num(obj[k]);
    if (n !== null) return n;
  }
  return null;
}

const AGENT_WORDS = ["agent", "danışman", "danisman", "temsilci", "sdr", "consultant", "rep"];
const CUSTOMER_WORDS = ["customer", "müşteri", "musteri", "client", "lead", "patient", "hasta"];

/**
 * Model, vurgulamak istediği yeri kanıt alıntısının içine markdown olarak
 * yazıyor ("**Estenove**"). Yıldızlar ekrana düz metin olarak düşmesin diye
 * burada ayıklanır ve o parçalar highlight'a çevrilir — yani modelin doğal
 * davranışı, ayrı bir highlight alanı vermese bile doğru sonucu üretir.
 */
export function stripBold(raw: string): { text: string; spans: string[] } {
  if (!raw.includes("**")) return { text: raw, spans: [] };
  const spans: string[] = [];
  const text = raw.replace(/\*\*([\s\S]+?)\*\*/g, (_m, inner: string) => {
    const t = inner.trim();
    if (t) spans.push(t);
    return inner;
  });
  return { text, spans };
}

function normalizeSpeaker(raw: string | null): Evidence["speaker"] {
  const s = (raw ?? "").toLowerCase();
  if (AGENT_WORDS.some((w) => s.includes(w))) return "agent";
  if (CUSTOMER_WORDS.some((w) => s.includes(w))) return "customer";
  return "other";
}

/**
 * highlight yalnızca alıntının birebir alt dizesiyse kabul edilir; tutmayan
 * parça sessizce düşer. Yanlış yeri kalınlaştırmaktansa hiç kalınlaştırmamak.
 */
function normalizeHighlights(raw: unknown, quote: string): string[] {
  const list = typeof raw === "string" ? [raw] : arr(raw);
  const out: string[] = [];
  for (const h of list) {
    if (typeof h !== "string") continue;
    const s = h.trim();
    if (s && quote.includes(s)) out.push(s);
  }
  return out;
}

function normalizeEvidence(raw: unknown, lang: "tr" | "en"): Evidence[] {
  const out: Evidence[] = [];
  for (const e of arr(raw)) {
    if (!isDict(e)) continue;
    // Alıntı ASLA çeviriye tabi değil — bu yüzden dile duyarlı okunmaz.
    const rawQuote = typeof e.text === "string" ? e.text.trim() : "";
    if (!rawQuote) continue;
    const { text: quote, spans } = stripBold(rawQuote);
    const speakerLabel = text(e, "tr", "speaker", "who", "role");
    // Ayrı highlight alanı varsa o da geçerli; ikisi birleşir, tekrarlar düşer.
    const highlights = [...new Set([...spans, ...normalizeHighlights(e.highlight ?? e.highlights, quote)])];
    out.push({
      speaker: normalizeSpeaker(speakerLabel),
      speakerLabel,
      text: quote,
      ts: text(e, "tr", "ts", "timestamp", "time"),
      highlights,
      note: text(e, lang, "note", "comment"),
    });
  }
  return out;
}

function normalizeSubs(raw: unknown, lang: "tr" | "en"): Sub[] {
  const out: Sub[] = [];
  for (const s of arr(raw)) {
    if (!isDict(s)) continue;
    const label = text(s, lang, "label", "name");
    if (!label) continue;
    out.push({ label, ok: s.ok === true || s.passed === true });
  }
  return out;
}

function idOf(obj: Dict): string {
  const v = obj.id ?? obj.criterionId ?? obj.code;
  return typeof v === "string" ? v.trim().toUpperCase() : "";
}

/** Etiket bloktan gelir; yoksa id'nin kendisi gösterilir. */
function labelOf(obj: Dict, lang: "tr" | "en", id: string): string {
  return text(obj, lang, "label", "name", "title") ?? id;
}

/* ──────────────────────────── normalleştirme ────────────────────────────── */

function toPassed(raw: Dict, lang: "tr" | "en"): PassedItem | null {
  const id = idOf(raw);
  if (!id) return null;
  return {
    id,
    label: labelOf(raw, lang, id),
    earned: firstNum(raw, "earned", "points"),
    max: firstNum(raw, "weight", "max", "maxPoints"),
    summary: text(raw, lang, "summary", "whatHappened", "note", "coachingNote"),
    subs: normalizeSubs(raw.subChecks ?? raw.subs, lang),
    evidence: normalizeEvidence(raw.evidence, lang),
  };
}

const BROKEN_VERDICTS = ["fail", "broken", "kırık", "kirik"];

function toFault(raw: Dict, lang: "tr" | "en"): FaultItem | null {
  const id = idOf(raw);
  if (!id) return null;

  const max = firstNum(raw, "weight", "max", "maxPoints");
  const explicitLoss = firstNum(raw, "loss", "lost");
  // earned ve loss birbirinin tümleyeni; blok hangisini verirse diğeri türetilir.
  const earned =
    firstNum(raw, "earned", "points") ??
    (explicitLoss !== null && max !== null ? round2(max - explicitLoss) : null);
  const loss = explicitLoss ?? (earned !== null && max !== null ? round2(max - earned) : null);

  // 0-100 kriter skoru: kayıp hesaplanamadığında gösterilecek yedek.
  const rawScore = firstNum(raw, "score");
  const altScore = loss === null ? rawScore : null;

  const verdict = (text(raw, "tr", "verdict", "result", "status") ?? "").toLowerCase();
  let severity: Severity;
  if (verdict) {
    severity = BROKEN_VERDICTS.some((w) => verdict.includes(w)) ? "broken" : "partial";
  } else if (earned !== null && max !== null) {
    severity = earned <= 0 ? "broken" : "partial";
  } else if (rawScore !== null) {
    severity = rawScore < 50 ? "broken" : "partial";
  } else {
    // Bilinmiyorsa "eksik" say — "kırık" daha ağır bir iddia.
    severity = "partial";
  }

  return {
    id,
    label: labelOf(raw, lang, id),
    severity,
    loss,
    altScore,
    whatHappened: text(raw, lang, "whatHappened", "summary", "coachingNote", "note"),
    note: text(raw, lang, "detail", "hint"),
    shouldHaveSaid: text(raw, lang, "shouldHaveSaid", "expected", "shouldSay"),
    subs: normalizeSubs(raw.subChecks ?? raw.subs, lang),
    evidence: normalizeEvidence(raw.evidence, lang),
  };
}

/**
 * Kırılan maddeler puan kaybına göre azalan sıralanır — model yanlış sırada
 * gönderse bile en pahalı hata en üstte çıkar. Sıra her zaman deterministik.
 */
function sortFaults(faults: FaultItem[]): FaultItem[] {
  return [...faults].sort((a, b) => {
    if (a.loss !== null && b.loss !== null && a.loss !== b.loss) return b.loss - a.loss;
    if (a.loss !== null && b.loss === null) return -1;
    if (a.loss === null && b.loss !== null) return 1;
    if (a.altScore !== null && b.altScore !== null && a.altScore !== b.altScore) {
      return a.altScore - b.altScore;
    }
    return a.id.localeCompare(b.id);
  });
}

/**
 * Bölüm ölçerleri. Önce zengin "sections" dizisi (bölüm adını da taşır),
 * yoksa "sectionScores" nesnesinin anahtarları. Anahtar kümesi sabit değil —
 * prompt D bölümü eklerse kod değişmeden görünür.
 */
function normalizeSections(rd: Dict, fallbackScores: unknown, lang: "tr" | "en"): SectionMeter[] {
  const rich = arr(rd.sections);
  if (rich.length > 0) {
    const out: SectionMeter[] = [];
    for (const s of rich) {
      if (!isDict(s)) continue;
      const key = text(s, "tr", "key", "id", "section");
      const score = firstNum(s, "score", "value");
      if (!key || score === null) continue;
      out.push({ key, label: text(s, lang, "label", "name"), score });
    }
    if (out.length > 0) return out;
  }

  // Blokta yoksa ayrı sectionScores kolonuna düş (eski kayıtlar).
  const scores = isDict(rd.sectionScores) ? rd.sectionScores : fallbackScores;
  if (!isDict(scores)) return [];
  const out: SectionMeter[] = [];
  for (const [key, value] of Object.entries(scores)) {
    const score = num(value);
    // null bölüm skoru = "bu bölümde puanlanabilir kriter yoktu" → ölçer çizilmez.
    if (score === null) continue;
    out.push({ key, label: null, score });
  }
  return out.sort((a, b) => a.key.localeCompare(b.key));
}

function mapList<T>(raw: unknown, map: (d: Dict) => T | null): T[] {
  const out: T[] = [];
  for (const item of arr(raw)) {
    if (!isDict(item)) continue;
    const mapped = map(item);
    if (mapped !== null) out.push(mapped);
  }
  return out;
}

/* ──────────────────────────────── giriş ─────────────────────────────────── */

export interface BuildInput {
  reportData?: unknown;
  /** Blokta kırılan madde yoksa geri düşülen kolon (eski kayıtlar). */
  weakCriteria?: unknown;
  /** Blokta bölüm skoru yoksa geri düşülen kolon (eski kayıtlar). */
  sectionScores?: unknown;
  lang?: "tr" | "en";
}

export function buildReportCard({ reportData, weakCriteria, sectionScores, lang = "tr" }: BuildInput): ReportCard {
  const rd: Dict = isDict(reportData) ? reportData : {};

  const blockFaults = rd.weakCriteria ?? rd.faults;
  const faultSource = arr(blockFaults).length > 0 ? blockFaults : weakCriteria;
  const passedSource = rd.passedCriteria ?? rd.passed;

  const passed = mapList(passedSource, (d) => toPassed(d, lang));
  const faults = sortFaults(mapList(faultSource, (d) => toFault(d, lang)));

  const na = mapList(rd.naCriteria ?? rd.na, (d) => {
    const id = idOf(d);
    if (!id) return null;
    return { id, label: labelOf(d, lang, id), reason: text(d, lang, "reason", "why", "note") };
  });

  const flags = mapList(rd.medicalFlags ?? rd.flags, (d) => {
    const title = text(d, lang, "title", "condition", "label", "name");
    if (!title) return null;
    return {
      title,
      qualifier: text(d, lang, "qualifier", "status"),
      detail: text(d, lang, "detail", "note", "reason"),
      escalation: d.escalation === true,
    };
  });

  const coaching = mapList(rd.coaching ?? rd.coachingFocus ?? rd.focus, (d) => {
    const title = text(d, lang, "title", "behaviour", "behavior", "label");
    if (!title) return null;
    return {
      title,
      detail: text(d, lang, "detail", "why", "description"),
      source: text(d, lang, "source", "step", "ref"),
    };
  });

  // Ham puan toplamı: puanı bilinen her maddeden. Uygulanmayan (na) maddeler
  // paydaya girmez — geçerli olmayan kriterin tam puanı toplamı şişirirdi.
  let earned = 0;
  let max = 0;
  let counted = false;
  for (const src of [passedSource, faultSource]) {
    for (const item of arr(src)) {
      if (!isDict(item)) continue;
      const m = firstNum(item, "weight", "max", "maxPoints");
      if (m === null) continue;
      // Kırılan maddelerde blok genelde earned yerine loss veriyor.
      const lost = firstNum(item, "loss", "lost");
      const e = firstNum(item, "earned", "points") ?? (lost !== null ? m - lost : null);
      if (e === null) continue;
      earned += e;
      max += m;
      counted = true;
    }
  }

  const hasEvidence = [...passed, ...faults].some((i) => i.evidence.length > 0);
  const sections = normalizeSections(rd, sectionScores, lang);

  return {
    band: text(rd, lang, "band", "scoreBand", "rating"),
    scorable: rd.scorable !== false,
    hardFail: rd.hardFail === true,
    classification: text(rd, "tr", "callClassification", "classification"),
    points: counted && max > 0 ? { earned: round2(earned), max: round2(max) } : null,
    sections,
    passed,
    faults,
    na,
    flags,
    coaching,
    tally: {
      passed: passed.length,
      partial: faults.filter((f) => f.severity === "partial").length,
      broken: faults.filter((f) => f.severity === "broken").length,
      na: na.length,
    },
    isEmpty:
      sections.length === 0 &&
      passed.length === 0 &&
      faults.length === 0 &&
      na.length === 0 &&
      flags.length === 0 &&
      coaching.length === 0,
    isSparse: faults.length > 0 && passed.length === 0 && !hasEvidence,
  };
}

/* ──────────────────────────────── skor bandı ────────────────────────────── */

/**
 * Blok "band" vermezse kullanılan yedek. Eşikler promptun BANDS tablosuyla
 * aynı (85 / 70 / 55). Prompt kendi bandını yollarsa bu hiç çalışmaz — bant
 * metnini değiştirmek için kodu değil promptu güncelle.
 */
const FALLBACK_BANDS = [
  { min: 85, tr: "Güçlü", en: "Strong" },
  { min: 70, tr: "Kabul edilebilir", en: "Acceptable" },
  { min: 55, tr: "Koçluk gerekiyor", en: "Coaching Required" },
  { min: -Infinity, tr: "Kritik", en: "Critical" },
] as const;

export function scoreBand(score: number, lang: "tr" | "en"): string {
  const band = FALLBACK_BANDS.find((b) => score >= b.min) ?? FALLBACK_BANDS[FALLBACK_BANDS.length - 1];
  return lang === "en" ? band.en : band.tr;
}
