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

const SECTION_PREFIXES = ["📊", "📝", "💰", "💭", "🛑", "🚨", "📈", "🔍", "💡", "🎯", "✅"];

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

export function formatReportToHtml(text: string): string {
  return text
    .split("\n")
    .map((line) => {
      const safe = escapeHtml(line);
      if (SECTION_PREFIXES.some((p) => line.startsWith(p))) {
        return `<div style="margin:18px 0 6px;font-weight:700;font-size:14px;color:#1d4ed8;border-bottom:1px solid #d1d5db;padding-bottom:4px;">${safe}</div>`;
      }
      if (/^(Temsilci:|Consultant:|Müşteri:|Customer:|Görüşme|Call |Genel Skor:|Overall Score:)/.test(line)) {
        return `<div style="font-size:13px;font-weight:600;color:#111111;padding:1px 0;">${safe}</div>`;
      }
      if (line.startsWith("•") || line.startsWith("-")) {
        return `<div style="font-size:13px;color:#111111;padding:2px 0 2px 12px;">${safe}</div>`;
      }
      if (line.includes("Kanıt:") || line.includes("Evidence:")) {
        return `<div style="font-size:12px;color:#047857;padding:1px 0 1px 24px;font-family:monospace;">${safe}</div>`;
      }
      if (line.includes("Olması Gereken:") || line.includes("Expected:")) {
        return `<div style="font-size:12px;color:#b45309;padding:1px 0 1px 24px;">${safe}</div>`;
      }
      if (line.trim() === "") return `<div style="height:6px;"></div>`;
      return `<div style="font-size:13px;color:#374151;padding:1px 0;">${safe}</div>`;
    })
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

const PDF_OPTS = {
  margin: 10,
  image: { type: "jpeg", quality: 0.95 },
  html2canvas: { scale: 2, useCORS: true },
  jsPDF: { unit: "mm", format: "a4", orientation: "portrait" },
};

// html2canvas needs the element in the DOM for correct layout.
// Attach off-screen, render, then clean up.
async function withPdfWorker<T>(html: string, run: (worker: any) => Promise<T>): Promise<T> {
  const html2pdf = (await import("html2pdf.js" as any)).default;
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.left = "-9999px";
  container.style.top = "0";
  container.style.width = "760px";
  container.innerHTML = html;
  document.body.appendChild(container);
  try {
    return await run(html2pdf().set(PDF_OPTS).from(container));
  } finally {
    container.remove();
  }
}

export async function downloadPdf(html: string, filename: string): Promise<void> {
  await withPdfWorker(html, (worker) =>
    worker.save(filename.endsWith(".pdf") ? filename : `${filename}.pdf`)
  );
}

export async function buildPdfBlob(html: string): Promise<Blob> {
  return withPdfWorker(html, (worker) => worker.outputPdf("blob"));
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
      const html = buildEvaluationHtml(g.agentName, g.evals, range, lang);
      const base = slugifyFilename(g.agentName);
      zip.file(`${base}.pdf`, await buildPdfBlob(html));
      zip.file(`${base}.doc`, docBlob(html));
    } catch {
      skipped.push(g.agentName);
    }
  }
  const out = await zip.generateAsync({ type: "blob" });
  triggerDownload(out, `degerlendirmeler_${zipDate}.zip`);
  return { skipped };
}
