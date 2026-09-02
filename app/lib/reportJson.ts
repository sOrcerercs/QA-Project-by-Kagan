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
  const scoreRaw = scoreMatch ? Math.round(parseFloat(scoreMatch[1].replace(",", "."))) : null;

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
