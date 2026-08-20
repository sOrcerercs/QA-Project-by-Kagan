import { describe, it, expect } from "vitest";
import { parseScanResults, tallyScan, type ScanRow } from "./analysisScan";
import type { AnalysisCall } from "./analysisRetrieval";

function call(over: Partial<AnalysisCall> = {}): AnalysisCall {
  return {
    id: "c1",
    agentId: "a1",
    agentName: "Ayşe Kaya",
    customerName: "Müşteri A",
    callDate: new Date("2026-08-10T09:00:00Z"),
    callType: "SECOND_CALL",
    score: 80,
    transcript: "…",
    report: "…",
    ...over,
  };
}

describe("parseScanResults", () => {
  it("parses the plain JSON shape", () => {
    const out = parseScanResults(
      '{"results":[{"call":1,"verdict":"EVET","evidence":"saat 17:00 dedi"},{"call":2,"verdict":"HAYIR","evidence":""}]}',
      2
    );
    expect(out).toEqual([
      { call: 1, verdict: "EVET", evidence: "saat 17:00 dedi" },
      { call: 2, verdict: "HAYIR", evidence: "" },
    ]);
  });

  it("survives code fences and prose around the JSON", () => {
    const raw = 'İşte sonuçlar:\n```json\n{"results":[{"call":3,"verdict":"evet","evidence":"x"}]}\n```\nUmarım yardımcı olur.';
    expect(parseScanResults(raw, 3)).toEqual([{ call: 3, verdict: "EVET", evidence: "x" }]);
  });

  it("accepts a bare array", () => {
    expect(parseScanResults('[{"call":1,"verdict":"BELIRSIZ","evidence":"kesilmiş kayıt"}]', 1)).toEqual([
      { call: 1, verdict: "BELIRSIZ", evidence: "kesilmiş kayıt" },
    ]);
  });

  it("normalises English and lowercase verdicts", () => {
    const out = parseScanResults('[{"call":1,"verdict":"yes","evidence":"a"},{"call":2,"verdict":"No","evidence":"b"},{"call":3,"verdict":"unclear","evidence":"c"}]', 3);
    expect(out.map((r) => r.verdict)).toEqual(["EVET", "HAYIR", "BELIRSIZ"]);
  });

  it("drops rows outside the call range and duplicates", () => {
    const out = parseScanResults('[{"call":0,"verdict":"EVET","evidence":""},{"call":9,"verdict":"EVET","evidence":""},{"call":2,"verdict":"EVET","evidence":"ilk"},{"call":2,"verdict":"HAYIR","evidence":"tekrar"}]', 3);
    expect(out).toEqual([{ call: 2, verdict: "EVET", evidence: "ilk" }]);
  });

  it("drops rows with an unknown verdict", () => {
    expect(parseScanResults('[{"call":1,"verdict":"belki","evidence":"x"}]', 2)).toEqual([]);
  });

  it("returns an empty array when there is no JSON at all", () => {
    expect(parseScanResults("Bu soruya cevap veremem.", 5)).toEqual([]);
  });

  it("caps very long evidence", () => {
    const out = parseScanResults(JSON.stringify({ results: [{ call: 1, verdict: "EVET", evidence: "z".repeat(900) }] }), 1);
    expect(out[0].evidence.length).toBeLessThanOrEqual(400);
  });
});

describe("tallyScan", () => {
  const calls = [
    call({ id: "1", agentId: "K", agentName: "Koray" }),
    call({ id: "2", agentId: "K", agentName: "Koray" }),
    call({ id: "3", agentId: "H", agentName: "Harun" }),
    call({ id: "4", agentId: "H", agentName: "Harun" }),
  ];

  it("counts per consultant in code, not by the model", () => {
    const rows: ScanRow[] = [
      { call: 1, verdict: "HAYIR", evidence: "" },
      { call: 2, verdict: "HAYIR", evidence: "" },
      { call: 3, verdict: "EVET", evidence: "" },
      { call: 4, verdict: "EVET", evidence: "" },
    ];
    expect(tallyScan(rows, calls)).toEqual([
      { agentId: "H", agentName: "Harun", total: 2, yes: 2, no: 0, unclear: 0, unanswered: 0 },
      { agentId: "K", agentName: "Koray", total: 2, yes: 0, no: 2, unclear: 0, unanswered: 0 },
    ]);
  });

  it("reports calls the model never answered instead of hiding them", () => {
    const rows: ScanRow[] = [{ call: 1, verdict: "EVET", evidence: "" }];
    const t = tallyScan(rows, calls);
    expect(t.find((x) => x.agentId === "K")).toEqual({
      agentId: "K", agentName: "Koray", total: 2, yes: 1, no: 0, unclear: 0, unanswered: 1,
    });
    expect(t.find((x) => x.agentId === "H")).toEqual({
      agentId: "H", agentName: "Harun", total: 2, yes: 0, no: 0, unclear: 0, unanswered: 2,
    });
  });

  it("orders by yes-rate so the outlier is visible first", () => {
    const rows: ScanRow[] = [
      { call: 1, verdict: "EVET", evidence: "" },
      { call: 2, verdict: "EVET", evidence: "" },
      { call: 3, verdict: "HAYIR", evidence: "" },
      { call: 4, verdict: "HAYIR", evidence: "" },
    ];
    expect(tallyScan(rows, calls).map((x) => x.agentName)).toEqual(["Koray", "Harun"]);
  });

  it("handles an empty scan", () => {
    expect(tallyScan([], [])).toEqual([]);
  });
});
