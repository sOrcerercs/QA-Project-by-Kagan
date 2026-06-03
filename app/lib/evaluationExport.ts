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
