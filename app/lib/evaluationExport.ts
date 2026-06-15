export interface ExportEvaluation {
  id: string;
  score: number;
  customerName: string;
  callDuration: string;
  callDate: string;
  callType?: string;
  report: string;
  agent?: { name?: string | null };
}

export interface DateRange {
  startDate?: string;
  endDate?: string;
}

export type Lang = "tr" | "en";

export interface AgentGroup {
  agentName: string;
  evals: ExportEvaluation[];
}

export function groupByAgent(evals: ExportEvaluation[]): AgentGroup[] {
  const map = new Map<string, ExportEvaluation[]>();
  for (const ev of evals) {
    const name = ev.agent?.name?.trim() || "Atanmamış";
    if (!map.has(name)) map.set(name, []);
    map.get(name)!.push(ev);
  }
  return [...map.entries()].map(([agentName, evals]) => ({ agentName, evals }));
}

const TR_MAP: Record<string, string> = {
  ç: "c", Ç: "C", ğ: "g", Ğ: "G", ı: "i", İ: "I",
  ö: "o", Ö: "O", ş: "s", Ş: "S", ü: "u", Ü: "U",
};

export function slugifyFilename(name: string): string {
  return (
    name
      .replace(/[çÇğĞıİöÖşŞüÜ]/g, (c) => TR_MAP[c] ?? c)
      .normalize("NFKD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-zA-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "") || "danisman"
  );
}

// Section headings in evaluation reports are prefixed with an emoji
// (📊 🏆 ✅ ❌ 🔍 📋 📌 …). Match ANY leading emoji rather than a fixed
// whitelist: the prompt's heading emoji set has changed over time, and a
// hardcoded list silently demoted headings whose emoji wasn't included to
// plain body text — which is why headings rendered with inconsistent
// size/color. A structural "starts with a pictograph" rule keeps every
// heading on the same section style. Bullets start with * / • / -, never an
// emoji, so the two never collide.
const SECTION_LEADING_EMOJI = /^\p{Extended_Pictographic}/u;

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

const LABELS = {
  tr: {
    title: "Değerlendirme Raporu", consultant: "Danışman", range: "Tarih Aralığı",
    total: "Toplam Değerlendirme", avg: "Ortalama Skor", duration: "Süre",
    callType: "Çağrı Tipi", evalDate: "Değerlendirme Tarihi", score: "Skor", all: "Tümü",
  },
  en: {
    title: "Evaluation Report", consultant: "Consultant", range: "Date Range",
    total: "Total Evaluations", avg: "Average Score", duration: "Duration",
    callType: "Call Type", evalDate: "Evaluation Date", score: "Score", all: "All",
  },
} as const;

function fmtDate(d: string, lang: Lang): string {
  const date = new Date(d);
  if (isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR");
}

export function buildEvaluationHtml(
  agentName: string,
  evals: ExportEvaluation[],
  range: DateRange,
  lang: Lang
): string {
  const L = LABELS[lang];
  const avg = evals.length
    ? Math.round(evals.reduce((a, e) => a + (e.score || 0), 0) / evals.length)
    : 0;
  const rangeText =
    range.startDate || range.endDate
      ? `${range.startDate ? fmtDate(range.startDate, lang) : "…"} — ${range.endDate ? fmtDate(range.endDate, lang) : "…"}`
      : L.all;

  const header = `
    <div style="margin-bottom:24px;border-bottom:2px solid #1d4ed8;padding-bottom:12px;">
      <div style="font-size:20px;font-weight:800;color:#111111;">${escapeHtml(L.title)}</div>
      <div style="font-size:14px;color:#374151;margin-top:6px;">${escapeHtml(L.consultant)}: <b>${escapeHtml(agentName)}</b></div>
      <div style="font-size:12px;color:#6b7280;margin-top:2px;">${escapeHtml(L.range)}: ${escapeHtml(rangeText)}</div>
      <div style="font-size:12px;color:#6b7280;">${escapeHtml(L.total)}: ${evals.length} · ${escapeHtml(L.avg)}: %${avg}</div>
    </div>`;

  const blocks = evals
    .map((ev, idx) => {
      const meta = `
      <div style="${idx > 0 ? "page-break-before:always;" : ""}margin-top:18px;background:#f3f4f6;border-radius:8px;padding:10px 12px;">
        <div style="font-size:14px;font-weight:700;color:#111111;">${escapeHtml(ev.customerName || "—")}</div>
        <div style="font-size:11px;color:#6b7280;margin-top:3px;">${escapeHtml(L.duration)}: ${escapeHtml(ev.callDuration || "—")}${ev.callType ? ` · ${escapeHtml(L.callType)}: ${escapeHtml(ev.callType)}` : ""} · ${escapeHtml(L.evalDate)}: ${fmtDate(ev.callDate, lang)} · ${escapeHtml(L.score)}: %${ev.score}</div>
      </div>`;
      return `${meta}<div style="margin-top:8px;">${formatReportToHtml(ev.report || "")}</div>`;
    })
    .join("");

  return `<div style="font-family:Arial,Helvetica,sans-serif;color:#111111;max-width:760px;">${header}${blocks}</div>`;
}

export type ReportLineKind = "section" | "meta" | "bullet" | "evidence" | "expected" | "blank" | "default";

// Classify a single report line — shared by the HTML (Word) and PDF renderers
// so both stay in sync with the on-screen formatReport rules.
export function classifyReportLine(line: string): ReportLineKind {
  if (SECTION_LEADING_EMOJI.test(line)) return "section";
  if (/^(Temsilci:|Consultant:|Müşteri:|Customer:|Görüşme|Call |Genel Skor:|Overall Score:)/.test(line)) return "meta";
  if (line.startsWith("•") || line.startsWith("-")) return "bullet";
  if (line.includes("Kanıt:") || line.includes("Evidence:")) return "evidence";
  if (line.includes("Olması Gereken:") || line.includes("Expected:")) return "expected";
  if (line.trim() === "") return "blank";
  return "default";
}

const HTML_STYLE: Record<ReportLineKind, (safe: string) => string> = {
  section: (s) => `<div style="margin:18px 0 6px;font-weight:700;font-size:14px;color:#1d4ed8;border-bottom:1px solid #d1d5db;padding-bottom:4px;">${s}</div>`,
  meta: (s) => `<div style="font-size:13px;font-weight:600;color:#111111;padding:1px 0;">${s}</div>`,
  bullet: (s) => `<div style="font-size:13px;color:#111111;padding:2px 0 2px 12px;">${s}</div>`,
  evidence: (s) => `<div style="font-size:12px;color:#047857;padding:1px 0 1px 24px;font-family:monospace;">${s}</div>`,
  expected: (s) => `<div style="font-size:12px;color:#b45309;padding:1px 0 1px 24px;">${s}</div>`,
  blank: () => `<div style="height:6px;"></div>`,
  default: (s) => `<div style="font-size:13px;color:#374151;padding:1px 0;">${s}</div>`,
};

export function formatReportToHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => HTML_STYLE[classifyReportLine(line)](escapeHtml(line)))
    .join("");
}

function wrapWordHtml(html: string): string {
  return `<!DOCTYPE html><html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:w="urn:schemas-microsoft-com:office:word" xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8"></head><body>${html}</body></html>`;
}

function docBlob(html: string): Blob {
  return new Blob(["﻿" + wrapWordHtml(html)], { type: "application/msword" });
}

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function downloadDoc(html: string, filename: string): void {
  triggerDownload(docBlob(html), filename.endsWith(".doc") ? filename : `${filename}.doc`);
}

// ---- PDF generation (text-based jsPDF) ----
// We render real text (not a rasterized HTML snapshot) so documents of any
// length paginate natively — no browser canvas-size limit, no truncation, far
// faster. A Unicode TTF (DejaVuSans) is embedded so Turkish ş/ğ/ı/İ render.

const PDF_FONT = "DejaVuSans";
const PDF_FONT_FILES: Record<"normal" | "bold", { vfs: string; url: string }> = {
  normal: { vfs: "DejaVuSans.ttf", url: "/fonts/DejaVuSans.ttf" },
  bold: { vfs: "DejaVuSans-Bold.ttf", url: "/fonts/DejaVuSans-Bold.ttf" },
};
const fontCache: { normal?: string; bold?: string } = {};

async function fetchFontBase64(url: string): Promise<string> {
  const buf = await (await fetch(url)).arrayBuffer();
  const bytes = new Uint8Array(buf);
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

// Register the embedded Unicode font into a fresh jsPDF instance (VFS is
// per-instance, so this runs per document; the base64 is cached across calls).
// Returns the font family to use, falling back to a built-in font if loading fails.
export async function registerPdfFont(doc: any): Promise<string> {
  try {
    fontCache.normal ??= await fetchFontBase64(PDF_FONT_FILES.normal.url);
    fontCache.bold ??= await fetchFontBase64(PDF_FONT_FILES.bold.url);
    doc.addFileToVFS(PDF_FONT_FILES.normal.vfs, fontCache.normal);
    doc.addFont(PDF_FONT_FILES.normal.vfs, PDF_FONT, "normal");
    doc.addFileToVFS(PDF_FONT_FILES.bold.vfs, fontCache.bold);
    doc.addFont(PDF_FONT_FILES.bold.vfs, PDF_FONT, "bold");
    return PDF_FONT;
  } catch {
    return "helvetica"; // graceful fallback — PDF still generates (Turkish glyphs may be off)
  }
}

interface PdfLineStyle {
  size: number;
  style: "normal" | "bold";
  color: [number, number, number];
  indent: number;
  gapBefore?: number;
  gapAfter?: number;
}

const PDF_STYLE: Record<ReportLineKind, PdfLineStyle> = {
  section: { size: 11, style: "bold", color: [29, 78, 216], indent: 0, gapBefore: 3, gapAfter: 1 },
  meta: { size: 9.5, style: "bold", color: [17, 17, 17], indent: 0 },
  bullet: { size: 9.5, style: "normal", color: [17, 17, 17], indent: 4 },
  evidence: { size: 9, style: "normal", color: [4, 120, 87], indent: 8 },
  expected: { size: 9, style: "normal", color: [180, 83, 9], indent: 8 },
  blank: { size: 9, style: "normal", color: [55, 65, 81], indent: 0 },
  default: { size: 9.5, style: "normal", color: [55, 65, 81], indent: 0 },
};

// Render a consultant's evaluations into an existing jsPDF doc. Exported for
// unit testing (pass a plain jsPDF + the default font). The browser path uses
// the embedded font via registerPdfFont.
export function renderEvaluationsToDoc(
  doc: any,
  agentName: string,
  evals: ExportEvaluation[],
  range: DateRange,
  lang: Lang,
  fontFamily: string = "helvetica"
): void {
  const L = LABELS[lang];
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const margin = 12;
  const maxW = pageW - margin * 2;
  const bottom = pageH - margin;
  let y = margin;

  const writeLine = (text: string, st: PdfLineStyle) => {
    doc.setFont(fontFamily, st.style);
    doc.setFontSize(st.size);
    doc.setTextColor(st.color[0], st.color[1], st.color[2]);
    const lh = st.size * 0.3528 * 1.2; // pt → mm, with line spacing
    const wrapped: string[] = doc.splitTextToSize(text, maxW - st.indent);
    for (const w of wrapped) {
      if (y + lh > bottom) {
        doc.addPage();
        y = margin;
      }
      doc.text(w, margin + st.indent, y);
      y += lh;
    }
  };

  const avg = evals.length
    ? Math.round(evals.reduce((a, e) => a + (e.score || 0), 0) / evals.length)
    : 0;
  const rangeText =
    range.startDate || range.endDate
      ? `${range.startDate ? fmtDate(range.startDate, lang) : "…"} — ${range.endDate ? fmtDate(range.endDate, lang) : "…"}`
      : L.all;

  writeLine(L.title, { size: 16, style: "bold", color: [17, 17, 17], indent: 0 });
  y += 1;
  writeLine(`${L.consultant}: ${agentName}`, { size: 11, style: "bold", color: [17, 17, 17], indent: 0 });
  writeLine(`${L.range}: ${rangeText}`, { size: 9.5, style: "normal", color: [107, 114, 128], indent: 0 });
  writeLine(`${L.total}: ${evals.length}  ·  ${L.avg}: %${avg}`, { size: 9.5, style: "normal", color: [107, 114, 128], indent: 0 });
  doc.setDrawColor(29, 78, 216);
  doc.setLineWidth(0.4);
  doc.line(margin, y, pageW - margin, y);
  y += 4;

  evals.forEach((ev, idx) => {
    if (idx > 0) {
      doc.addPage();
      y = margin;
    }
    writeLine(ev.customerName || "—", { size: 12, style: "bold", color: [17, 17, 17], indent: 0 });
    const meta = [`${L.duration}: ${ev.callDuration || "—"}`];
    if (ev.callType) meta.push(`${L.callType}: ${ev.callType}`);
    meta.push(`${L.evalDate}: ${fmtDate(ev.callDate, lang)}`);
    meta.push(`${L.score}: %${ev.score}`);
    writeLine(meta.join("  ·  "), { size: 9, style: "normal", color: [107, 114, 128], indent: 0 });
    y += 1;

    for (const raw of (ev.report || "").split("\n")) {
      const st = PDF_STYLE[classifyReportLine(raw)];
      if (raw.trim() === "") {
        y += 2;
        continue;
      }
      if (st.gapBefore) y += st.gapBefore;
      writeLine(raw, st);
      if (st.gapAfter) y += st.gapAfter;
    }
  });
}

async function buildEvaluationDoc(
  agentName: string,
  evals: ExportEvaluation[],
  range: DateRange,
  lang: Lang
): Promise<any> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4", orientation: "portrait" });
  const fontFamily = await registerPdfFont(doc);
  renderEvaluationsToDoc(doc, agentName, evals, range, lang, fontFamily);
  return doc;
}

export async function downloadPdf(
  agentName: string,
  evals: ExportEvaluation[],
  range: DateRange,
  lang: Lang,
  filename: string
): Promise<void> {
  const doc = await buildEvaluationDoc(agentName, evals, range, lang);
  doc.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`);
}

export async function buildPdfBlob(
  agentName: string,
  evals: ExportEvaluation[],
  range: DateRange,
  lang: Lang
): Promise<Blob> {
  const doc = await buildEvaluationDoc(agentName, evals, range, lang);
  return doc.output("blob");
}

export async function downloadAllZip(
  groups: AgentGroup[],
  range: DateRange,
  lang: Lang,
  zipDate: string
): Promise<{ skipped: string[] }> {
  const JSZip = (await import("jszip")).default;
  const zip = new JSZip();
  const skipped: string[] = [];
  for (const g of groups) {
    try {
      const base = slugifyFilename(g.agentName);
      zip.file(`${base}.pdf`, await buildPdfBlob(g.agentName, g.evals, range, lang));
      zip.file(`${base}.doc`, docBlob(buildEvaluationHtml(g.agentName, g.evals, range, lang)));
    } catch {
      skipped.push(g.agentName);
    }
  }
  const out = await zip.generateAsync({ type: "blob" });
  triggerDownload(out, `degerlendirmeler_${zipDate}.zip`);
  return { skipped };
}
