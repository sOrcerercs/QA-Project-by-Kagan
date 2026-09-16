import { describe, it, expect } from "vitest";
import { evaluationLoss, selectRecurringWeakness, type BriefingEval } from "./coachingBriefing";

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

const wc = (rows: Array<{ id: string; label: string; score: number }>) => rows;

describe("selectRecurringWeakness", () => {
  it("en sık tekrar eden kriteri bulur ve o kriterin en dibe vurduğu çağrıyı önce sıralar", () => {
    const history = [
      ev({ id: "h1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 40 }]) }),
      ev({ id: "h2", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 55 }]) }),
      ev({ id: "h3", weakCriteria: wc([{ id: "A1", label: "Selamlama", score: 60 }]) }),
    ];
    const week = [
      ev({ id: "w1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 50 }]) }),
      ev({ id: "w2", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 20 }]) }),
    ];
    const out = selectRecurringWeakness(week, history, 4);
    expect(out.map((c) => c.evaluationId)).toEqual(["w2", "w1"]);
    expect(out[0].reason).toBe("RECURRING_WEAKNESS");
    expect(out[0].reasonData).toMatchObject({
      criterionId: "C3",
      criterionLabel: "Kapanış",
      occurrences: 2,
      windowWeeks: 4,
    });
  });

  it("hiçbir kriter iki kez geçmiyorsa boş döner", () => {
    const history = [
      ev({ id: "h1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 40 }]) }),
      ev({ id: "h2", weakCriteria: wc([{ id: "A1", label: "Selamlama", score: 40 }]) }),
    ];
    const week = [ev({ id: "w1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 50 }]) })];
    expect(selectRecurringWeakness(week, history, 4)).toEqual([]);
  });

  it("tekrar eden kriter o hafta hiç geçmiyorsa boş döner", () => {
    const history = [
      ev({ id: "h1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 40 }]) }),
      ev({ id: "h2", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 45 }]) }),
    ];
    const week = [ev({ id: "w1", weakCriteria: wc([{ id: "A1", label: "Selamlama", score: 50 }]) })];
    expect(selectRecurringWeakness(week, history, 4)).toEqual([]);
  });

  it("weakCriteria boş ya da dizi değilse çökmez", () => {
    const history = [ev({ id: "h1", weakCriteria: null }), ev({ id: "h2", weakCriteria: "bozuk" })];
    const week = [ev({ id: "w1", weakCriteria: undefined })];
    expect(selectRecurringWeakness(week, history, 4)).toEqual([]);
  });

  it("beraberlikte ortalama kriter skoru düşük olanı seçer", () => {
    const history = [
      ev({ id: "h1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 70 }, { id: "A1", label: "Selamlama", score: 20 }]) }),
      ev({ id: "h2", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 70 }, { id: "A1", label: "Selamlama", score: 30 }]) }),
    ];
    const week = [
      ev({ id: "w1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 65 }, { id: "A1", label: "Selamlama", score: 25 }]) }),
    ];
    const out = selectRecurringWeakness(week, history, 4);
    expect(out[0].reasonData.criterionId).toBe("A1");
  });

  it("eşit kriter skorunda id'ye göre belirlenimci sıralar", () => {
    const history = [
      ev({ id: "h1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 40 }]) }),
      ev({ id: "h2", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 45 }]) }),
    ];
    const wA = ev({ id: "wA", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 30 }]) });
    const wB = ev({ id: "wB", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 30 }]) });
    const first = selectRecurringWeakness([wB, wA], history, 4);
    const second = selectRecurringWeakness([wA, wB], history, 4);
    expect(first.map((c) => c.evaluationId)).toEqual(["wA", "wB"]);
    expect(first.map((c) => c.evaluationId)).toEqual(second.map((c) => c.evaluationId));
  });
});

import { selectBiggestLoss } from "./coachingBriefing";

describe("selectBiggestLoss", () => {
  it("kaybı büyükten küçüğe sıralar", () => {
    const week = [
      ev({ id: "w1", score: 90 }),
      ev({ id: "w2", score: 55 }),
      ev({ id: "w3", score: 78 }),
    ];
    const out = selectBiggestLoss(week);
    expect(out.map((c) => c.evaluationId)).toEqual(["w2", "w3", "w1"]);
    expect(out[0].reason).toBe("BIGGEST_LOSS");
    expect(out[0].reasonData.loss).toBe(45);
  });

  it("kusursuz çağrıları eler", () => {
    const week = [ev({ id: "w1", score: 100 }), ev({ id: "w2", score: 70 })];
    expect(selectBiggestLoss(week).map((c) => c.evaluationId)).toEqual(["w2"]);
  });

  it("boş haftada boş döner", () => {
    expect(selectBiggestLoss([])).toEqual([]);
  });

  it("eşit kayıpta id'ye göre belirlenimci sıralar", () => {
    const a = selectBiggestLoss([ev({ id: "wB", score: 70 }), ev({ id: "wA", score: 70 })]);
    const b = selectBiggestLoss([ev({ id: "wA", score: 70 }), ev({ id: "wB", score: 70 })]);
    expect(a.map((c) => c.evaluationId)).toEqual(["wA", "wB"]);
    expect(a.map((c) => c.evaluationId)).toEqual(b.map((c) => c.evaluationId));
  });
});

import { selectStandout } from "./coachingBriefing";

describe("selectStandout", () => {
  const history = [
    ev({ id: "h1", score: 70 }),
    ev({ id: "h2", score: 70 }),
    ev({ id: "h3", score: 70 }),
    ev({ id: "h4", score: 70 }),
  ];

  it("yukarı sapmayı STANDOUT_UP olarak işaretler", () => {
    const week = [ev({ id: "w1", score: 88 })];
    const out = selectStandout(week, history);
    expect(out[0].reason).toBe("STANDOUT_UP");
    expect(out[0].reasonData).toMatchObject({ deviation: 18, average: 70 });
  });

  it("aşağı sapmayı STANDOUT_DOWN olarak işaretler", () => {
    const week = [ev({ id: "w1", score: 50 })];
    const out = selectStandout(week, history);
    expect(out[0].reason).toBe("STANDOUT_DOWN");
    expect(out[0].reasonData.deviation).toBe(-20);
  });

  it("mutlak sapması büyük olanı öne alır", () => {
    const week = [ev({ id: "w1", score: 78 }), ev({ id: "w2", score: 45 })];
    expect(selectStandout(week, history).map((c) => c.evaluationId)).toEqual(["w2", "w1"]);
  });

  it("eşik altındaki sapmaları eler", () => {
    const week = [ev({ id: "w1", score: 73 })];
    expect(selectStandout(week, history)).toEqual([]);
  });

  it("geçmiş üç değerlendirmeden azsa ortalamaya güvenmez", () => {
    const week = [ev({ id: "w1", score: 95 })];
    expect(selectStandout(week, [ev({ id: "h1", score: 60 }), ev({ id: "h2", score: 60 })])).toEqual([]);
  });

  it("hepsi aynı skorsa boş döner", () => {
    const week = [ev({ id: "w1", score: 70 })];
    expect(selectStandout(week, history)).toEqual([]);
  });

  it("eşit mutlak sapmada id'ye göre belirlenimci sıralar", () => {
    // 85 (+15) ve 55 (-15): mutlak sapma eşit, yön farklı.
    const a = selectStandout([ev({ id: "wB", score: 85 }), ev({ id: "wA", score: 55 })], history);
    const b = selectStandout([ev({ id: "wA", score: 55 }), ev({ id: "wB", score: 85 })], history);
    expect(a.map((c) => c.evaluationId)).toEqual(["wA", "wB"]);
    expect(a.map((c) => c.evaluationId)).toEqual(b.map((c) => c.evaluationId));
  });
});
