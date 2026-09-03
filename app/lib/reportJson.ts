/**
 * Model çıktısındaki ===JSON_DATA=== bloğunu ayrıştırır.
 *
 * Aynı mantık analyze, batch, re-classify ve refine route'larında dört ayrı
 * kopya hâlinde duruyordu; `reportData` gibi yeni bir alan eklendiğinde dördünü
 * birden güncellemek gerekiyordu (biri unutulursa o kaynaktan gelen kayıtlarda
 * kart boş kalır). Tek kaynak burası.
 */

import type { Prisma } from "@/app/generated/prisma";

export interface ExtractedReport {
  /** JSON bloğu çıkarılmış, ekranda gösterilen rapor metni. */
  cleanReport: string;
  /** Rapor metninden okunan genel skor; bulunamazsa 0. */
  score: number;
  /**
   * Skor bulunamadıysa null. Yeniden değerlendirme yapan route'lar (re-classify,
   * refine) bunu kullanır: skor satırı okunamadığında kaydın mevcut skorunu
   * korurlar, 0 yazmazlar.
   */
  scoreRaw: number | null;
  sectionScores: { A: number; B: number; C: number } | null;
  weakCriteria: Array<{ id: string; label: string; score: number; coachingNote: string }> | null;
  /** Bloğun tamamı — şeması prompt sürümüyle birlikte büyüyebilir. */
  reportData: Record<string, unknown> | null;
}

const BLOCK = /===JSON_DATA===([\s\S]*?)===END_JSON===/;
const BLOCK_STRIP = /\n*===JSON_DATA===[\s\S]*?===END_JSON===/g;

/**
 * Skor satırı. Prompt'ta "Genel Skor:" / "Puan:" başlığı değişirse tüm yeni
 * kayıtlar 0 puan alır — prompt sürümü yükseltilirken bu satır korunmalı.
 */
const SCORE_LINE = /(?:Genel Skor|Overall Score|Puan):[^0-9\n]*(\d+(?:[.,]\d+)?)/i;

/**
 * Skoru bloğun kriter verisinden hesaplar.
 *
 * NEDEN: model çok terimli toplamda yanılıyor. 1-2 Eylül'ün 87 kaydında
 * ÖLÇÜLDÜ — 16'sında (%18) modelin yazdığı `overallScore` kendi
 * passedCriteria/weakCriteria verisini tutmuyor; sapma −10 ile +26 puan
 * arasında. Kartta da görünüyordu: sayaç "7 / 18 puan" derken büyük skor
 * "%65" diyordu.
 *
 * Verdict'ler ve ağırlıklar güvenilir (yargı ve tablo okuması); güvenilmez
 * olan aritmetik. O yüzden toplamı burada yapıyoruz.
 *
 * naCriteria paydaya girmez. hardFail skoru sıfırlar. Veri eksikse null
 * döner ve çağıran metinden okunan skora düşer.
 */
export function deriveScoreFromBlock(reportData: unknown): number | null {
  if (!reportData || typeof reportData !== "object") return null;
  const d = reportData as Record<string, unknown>;
  if (d.scorable === false) return null;

  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const items = [
    ...list(d.passedCriteria ?? d.passed),
    ...list(d.weakCriteria ?? d.faults),
  ];
  if (items.length === 0) return null;

  let earned = 0;
  let applicable = 0;
  for (const raw of items) {
    if (!raw || typeof raw !== "object") return null;
    const c = raw as Record<string, unknown>;
    // D1 ağırlıksız bir geçersiz kılma; paydaya girmez.
    if (String(c.id ?? "").toUpperCase() === "D1") continue;
    const weight = typeof c.weight === "number" ? c.weight : typeof c.max === "number" ? c.max : null;
    if (weight === null) return null;
    const got =
      typeof c.earned === "number"
        ? c.earned
        : typeof c.loss === "number"
        ? weight - c.loss
        : null;
    if (got === null) return null;
    earned += got;
    applicable += weight;
  }
  if (applicable <= 0) return null;
  if (d.hardFail === true) return 0;
  return Math.round((earned / applicable) * 100);
}

/**
 * Bölüm skorlarını da bloğun kriter verisinden hesaplar — genel skorla aynı
 * gerekçe. ÖLÇÜLDÜ: 86 kaydın 6'sında modelin bölüm skorları kendi kriter
 * verisini tutmuyordu (ör. B: model %33, hesap %0).
 *
 * Bir bölümde uygulanabilir kriter yoksa değeri null olur — "o bölümde
 * puanlanacak bir şey yoktu" demek; 0 ile karıştırılmamalı.
 */
export function deriveSectionScoresFromBlock(
  reportData: unknown,
): { A: number; B: number; C: number } | null {
  if (!reportData || typeof reportData !== "object") return null;
  const d = reportData as Record<string, unknown>;
  if (d.scorable === false) return null;

  const list = (v: unknown) => (Array.isArray(v) ? v : []);
  const items = [...list(d.passedCriteria ?? d.passed), ...list(d.weakCriteria ?? d.faults)];
  if (items.length === 0) return null;

  const acc: Record<string, { earned: number; applicable: number }> = {};
  for (const raw of items) {
    if (!raw || typeof raw !== "object") return null;
    const c = raw as Record<string, unknown>;
    const id = String(c.id ?? "").toUpperCase();
    if (id === "D1") continue;              // ağırlıksız geçersiz kılma
    const section = id.charAt(0);
    if (!"ABC".includes(section)) continue; // sözlük dışı id — bölüme yazılamaz
    const weight = typeof c.weight === "number" ? c.weight : typeof c.max === "number" ? c.max : null;
    if (weight === null) return null;
    const got =
      typeof c.earned === "number" ? c.earned : typeof c.loss === "number" ? weight - c.loss : null;
    if (got === null) return null;
    (acc[section] ??= { earned: 0, applicable: 0 });
    acc[section].earned += got;
    acc[section].applicable += weight;
  }

  const out = {} as { A: number; B: number; C: number };
  let any = false;
  for (const section of ["A", "B", "C"] as const) {
    const a = acc[section];
    // null: bu bölümde uygulanabilir kriter yok. Prisma Json'a null yazılabilir.
    (out as Record<string, number | null>)[section] =
      a && a.applicable > 0 ? Math.round((a.earned / a.applicable) * 100) : null;
    if (a && a.applicable > 0) any = true;
  }
  return any ? out : null;
}

export function extractReportJson(reportText: string): ExtractedReport {
  const text = typeof reportText === "string" ? reportText : "";

  let sectionScores: ExtractedReport["sectionScores"] = null;
  let weakCriteria: ExtractedReport["weakCriteria"] = null;
  let reportData: ExtractedReport["reportData"] = null;

  const match = text.match(BLOCK);
  if (match) {
    try {
      const parsed = JSON.parse(match[1].trim());
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        reportData = parsed as Record<string, unknown>;
        if (parsed.sectionScores && typeof parsed.sectionScores === "object") {
          sectionScores = parsed.sectionScores;
        }
        if (Array.isArray(parsed.weakCriteria)) weakCriteria = parsed.weakCriteria;
      }
    } catch (err) {
      console.warn("[reportJson] JSON_DATA bloğu ayrıştırılamadı:", err);
    }
  }

  const cleanReport = text.replace(BLOCK_STRIP, "").trim();
  const scoreMatch = cleanReport.match(SCORE_LINE);
  const textScore = scoreMatch ? Math.round(parseFloat(scoreMatch[1].replace(",", "."))) : null;

  // Blok yeterliyse skoru ondan hesapla; metinden okunan skor yalnızca yedek.
  const derived = deriveScoreFromBlock(reportData);
  const scoreRaw = derived ?? textScore;

  // Bölüm skorları için de aynısı: modelin yazdığı değil, kriter verisinden
  // hesaplanan kullanılır. Hesaplanamıyorsa modelin verdiği kalır.
  const derivedSections = deriveSectionScoresFromBlock(reportData);
  if (derivedSections) sectionScores = derivedSections;

  return { cleanReport, score: scoreRaw ?? 0, scoreRaw, sectionScores, weakCriteria, reportData };
}

/**
 * Prisma `create`/`update` için alan kırpıntısı. Boş değerler hiç yazılmaz ki
 * mevcut satırlar null'la ezilmesin.
 *
 * Cast: Prisma'nın Json giriş tipi (`InputJsonValue`) `unknown` değerli bir
 * Record kabul etmiyor; blok şeması prompt sürümüyle değiştiği için burada
 * yapıyı daha dar tiplemenin bir faydası da yok.
 */
export function reportJsonFields(extracted: Pick<ExtractedReport, "sectionScores" | "weakCriteria" | "reportData">) {
  return {
    ...(extracted.sectionScores && { sectionScores: extracted.sectionScores }),
    ...(extracted.weakCriteria && extracted.weakCriteria.length > 0 && { weakCriteria: extracted.weakCriteria }),
    ...(extracted.reportData && { reportData: extracted.reportData as Prisma.InputJsonValue }),
  };
}
