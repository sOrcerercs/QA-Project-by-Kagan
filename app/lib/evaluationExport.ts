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
