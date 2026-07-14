import { describe, it, expect } from "vitest";
import { extractSummaryJson, isCoachingSummaryFresh } from "./coachingSummary";

describe("extractSummaryJson", () => {
  it("düz JSON'u ayrıştırır", () => {
    expect(extractSummaryJson('{"summary":"iyi","actionItems":["a","b"]}'))
      .toEqual({ summary: "iyi", actionItems: ["a", "b"] });
  });
  it("```json fence'lerini tolere eder", () => {
    expect(extractSummaryJson('```json\n{"summary":"x","actionItems":["y"]}\n```'))
      .toEqual({ summary: "x", actionItems: ["y"] });
  });
  it("çevredeki metni tolere eder (ilk {..son })", () => {
    expect(extractSummaryJson('İşte özet: {"summary":"z","actionItems":[]} teşekkürler'))
      .toEqual({ summary: "z", actionItems: [] });
  });
  it("actionItems yoksa boş dizi döner, summary'yi korur", () => {
    expect(extractSummaryJson('{"summary":"yalnız özet"}'))
      .toEqual({ summary: "yalnız özet", actionItems: [] });
  });
  it("actionItems içindeki boş/dizi-olmayan öğeleri eler", () => {
    expect(extractSummaryJson('{"summary":"s","actionItems":["a","",5,"b"]}'))
      .toEqual({ summary: "s", actionItems: ["a", "b"] });
  });
  it("summary boş/eksikse fırlatır", () => {
    expect(() => extractSummaryJson('{"actionItems":["a"]}')).toThrow();
    expect(() => extractSummaryJson('{"summary":"   ","actionItems":[]}')).toThrow();
  });
  it("JSON yoksa fırlatır", () => {
    expect(() => extractSummaryJson("düz metin, JSON yok")).toThrow();
    expect(() => extractSummaryJson("")).toThrow();
  });
});

describe("isCoachingSummaryFresh", () => {
  it("summary var ve evalCount eşitse taze", () => {
    expect(isCoachingSummaryFresh({ summary: "s", evalCount: 5 }, 5)).toBe(true);
  });
  it("evalCount farklıysa bayat", () => {
    expect(isCoachingSummaryFresh({ summary: "s", evalCount: 5 }, 6)).toBe(false);
  });
  it("summary yok/boş ise taze değil", () => {
    expect(isCoachingSummaryFresh({ summary: null, evalCount: 5 }, 5)).toBe(false);
    expect(isCoachingSummaryFresh({ summary: "", evalCount: 5 }, 5)).toBe(false);
  });
  it("cache yoksa taze değil", () => {
    expect(isCoachingSummaryFresh(null, 5)).toBe(false);
  });
});
