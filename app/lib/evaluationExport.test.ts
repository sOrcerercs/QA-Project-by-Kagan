import { describe, it, expect } from "vitest";
import { groupByAgent, slugifyFilename, type ExportEvaluation } from "./evaluationExport";

function ev(partial: Partial<ExportEvaluation>): ExportEvaluation {
  return {
    id: "1", score: 70, customerName: "X", callDuration: "05:00",
    callDate: "2026-06-01", report: "rapor",
    ...partial,
  };
}

describe("groupByAgent", () => {
  it("groups evaluations by agent name", () => {
    const groups = groupByAgent([
      ev({ id: "a", agent: { name: "Ayşe" } }),
      ev({ id: "b", agent: { name: "Mehmet" } }),
      ev({ id: "c", agent: { name: "Ayşe" } }),
    ]);
    expect(groups).toHaveLength(2);
    const ayse = groups.find((g) => g.agentName === "Ayşe");
    expect(ayse?.evals.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("buckets missing names under 'Atanmamış'", () => {
    const groups = groupByAgent([
      ev({ id: "a", agent: { name: null } }),
      ev({ id: "b" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].agentName).toBe("Atanmamış");
    expect(groups[0].evals).toHaveLength(2);
  });
});

describe("slugifyFilename", () => {
  it("transliterates Turkish characters and replaces spaces", () => {
    expect(slugifyFilename("Ayşe Çelik")).toBe("Ayse_Celik");
    expect(slugifyFilename("İrem Öztürk")).toBe("Irem_Ozturk");
  });

  it("falls back to 'danisman' for empty input", () => {
    expect(slugifyFilename("   ")).toBe("danisman");
    expect(slugifyFilename("!!!")).toBe("danisman");
  });
});
