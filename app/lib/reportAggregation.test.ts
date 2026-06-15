import { describe, it, expect } from "vitest";
import { aggregateReport, type AggregationInput } from "./reportAggregation";

const agent = (id: string, name: string, teamName?: string) => ({
  id, name, teamId: teamName ? `team_${teamName}` : null,
  team: teamName ? { name: teamName } : null,
  role: "AGENT" as const, manager: null,
});

const evalRow = (agentId: string, a: any, score: number, callType: string, duration = "10:00", promptId: string | null = "p1") => ({
  agentId, score, callType, callDuration: duration, promptId,
  callDate: new Date("2026-06-10T10:00:00Z"), agent: a,
});

describe("aggregateReport", () => {
  it("computes summary, performance and distributions for one period", () => {
    const a1 = agent("a1", "Ada Lovelace", "Mavi");
    const a2 = agent("a2", "Bora Kaya", "Mavi");
    const input: AggregationInput = {
      evaluations: [
        evalRow("a1", a1, 80, "SECOND_CALL"),
        evalRow("a1", a1, 60, "FIRST_CALL"),
        evalRow("a2", a2, 50, "SECOND_CALL"),
      ],
      visibleAgents: [a1, a2, agent("a3", "Cem Yok", "Mavi")],
      promptNameById: new Map([["p1", "SDR"]]),
    };
    const out = aggregateReport(input);

    expect(out.summary.totalEvaluations).toBe(3);
    expect(out.summary.avgScore).toBe(63);
    expect(out.summary.highPotential).toBe(1);
    expect(out.summary.atRisk).toBe(1);
    expect(out.consultantPerformance[0].agentId).toBe("a1");
    expect(out.consultantPerformance[0].calls).toBe(2);
    expect(out.unlistenedConsultants.map(u => u.name)).toContain("Cem Yok");
    expect(out.teamDistribution[0].team).toBe("Mavi");
    expect(out.teamDistribution[0].totalCalls).toBe(3);
  });

  it("returns zeroed summary for empty input", () => {
    const out = aggregateReport({ evaluations: [], visibleAgents: [], promptNameById: new Map() });
    expect(out.summary).toEqual({ totalEvaluations: 0, totalSecondCalls: 0, avgScore: 0, highPotential: 0, atRisk: 0 });
    expect(out.consultantPerformance).toEqual([]);
  });
});
