import { describe, it, expect } from "vitest";
import { evaluationLoss, type BriefingEval } from "./coachingBriefing";

function ev(over: Partial<BriefingEval> = {}): BriefingEval {
  return {
    id: "e1",
    customerName: "Ali Veli",
    callDate: "2026-09-15T09:00:00.000Z",
    score: 80,
    weakCriteria: null,
    reportData: null,
    coachingDone: false,
    ...over,
  };
}

describe("evaluationLoss", () => {
  it("bloktaki kriter kayıplarını toplar", () => {
    const e = ev({
      score: 70,
      reportData: {
        weakCriteria: [
          { id: "A3", label: "Medikal Profil", loss: 0.75, weight: 1.5 },
          { id: "C3", label: "Kapanış", loss: 2.25, weight: 3 },
        ],
      },
    });
    expect(evaluationLoss(e)).toBeCloseTo(3.0, 5);
  });

  it("loss yoksa max - earned'dan türetir", () => {
    const e = ev({
      score: 70,
      reportData: { weakCriteria: [{ id: "A3", label: "Medikal", earned: 0.5, weight: 1.5 }] },
    });
    expect(evaluationLoss(e)).toBeCloseTo(1.0, 5);
  });

  it("blok yoksa 100 - score'a düşer", () => {
    expect(evaluationLoss(ev({ score: 62, reportData: null }))).toBe(38);
  });

  it("boş blok da bloksuz kayıt gibi 100 - score'a düşer", () => {
    // Tasarım gereği buildReportCard'da boş blockFaults, üst seviye weakCriteria'ya düşüyor.
    // İkisi de null sonuç veriyor, bu ikiye ayrı test açmamız gereksiz olsa da
    // bloktaki faultSource seçimini doğrulamak için ayrı tutulur.
    const e = ev({ score: 95, reportData: { weakCriteria: [] } });
    expect(evaluationLoss(e)).toBe(5);
  });

  it("blok yoksa eski weakCriteria kolonundan kayıp türetir", () => {
    const e = ev({
      score: 62,
      reportData: null,
      weakCriteria: [{ id: "A3", label: "Medikal", earned: 0.5, weight: 1.5 }],
    });
    // 100 - 62 = 38 yedeğine DÜŞMEZ; kayıp eski kolondan gelir.
    expect(evaluationLoss(e)).toBeCloseTo(1.0, 5);
  });

  it("kusursuz çağrıda sıfır döner", () => {
    expect(evaluationLoss(ev({ score: 100, reportData: null }))).toBe(0);
  });
});
