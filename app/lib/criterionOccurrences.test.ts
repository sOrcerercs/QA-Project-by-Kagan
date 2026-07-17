import { describe, it, expect } from "vitest";
import { extractCriterionOccurrences } from "./criterionOccurrences";

const evals = [
  {
    id: "e1",
    customerName: "Ali Veli",
    callDate: "2026-05-10T09:00:00.000Z",
    score: 82,
    weakCriteria: [
      { id: "A1", label: "Selamlama", score: 40 },
      { id: "B2", label: "İtiraz karşılama", score: 55 },
    ],
  },
  {
    id: "e2",
    customerName: "Ayşe Yıldız",
    callDate: new Date("2026-05-12T09:00:00.000Z"),
    score: 90,
    weakCriteria: [{ id: "A1", label: "Selamlama", score: 60 }],
  },
  {
    id: "e3",
    customerName: "Boş Kriter",
    callDate: "2026-05-13T09:00:00.000Z",
    score: 70,
    weakCriteria: null,
  },
];

describe("extractCriterionOccurrences", () => {
  it("kriter geçen değerlendirmeleri criterionScore ile döndürür", () => {
    const out = extractCriterionOccurrences(evals, "A1");
    expect(out).toEqual([
      { evaluationId: "e1", customerName: "Ali Veli", callDate: "2026-05-10T09:00:00.000Z", score: 82, criterionScore: 40 },
      { evaluationId: "e2", customerName: "Ayşe Yıldız", callDate: "2026-05-12T09:00:00.000Z", score: 90, criterionScore: 60 },
    ]);
  });

  it("kriter geçmeyen değerlendirmeleri atlar", () => {
    expect(extractCriterionOccurrences(evals, "C9")).toEqual([]);
  });

  it("weakCriteria dizi değilse (null) atlar", () => {
    const out = extractCriterionOccurrences(evals, "B2");
    expect(out.map(o => o.evaluationId)).toEqual(["e1"]);
  });

  it("boş girdi → boş dizi", () => {
    expect(extractCriterionOccurrences([], "A1")).toEqual([]);
  });
});
