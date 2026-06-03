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
