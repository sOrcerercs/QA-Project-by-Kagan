import { describe, it, expect } from "vitest";
import { extractKeywords, MAX_KEYWORDS } from "./analysisRetrieval";

describe("extractKeywords", () => {
  it("drops stopwords and short words", () => {
    expect(extractKeywords("Bu ay çok fiyat itirazı var mı?")).toEqual(["fiyat", "itirazi"]);
  });

  it("folds Turkish characters like the agent matcher", () => {
    expect(extractKeywords("İTİRAZ şikayet")).toEqual(["itiraz", "sikayet"]);
  });

  it("deduplicates repeated words", () => {
    expect(extractKeywords("fiyat fiyat FİYAT")).toEqual(["fiyat"]);
  });

  it("strips punctuation and returns at most MAX_KEYWORDS words", () => {
    const q = "greft, kampanya; ameliyat: konsultasyon. anestezi klinik doktor ekim taksit havale";
    const out = extractKeywords(q);
    expect(out.length).toBe(MAX_KEYWORDS);
    expect(out[0]).toBe("greft");
    expect(out).not.toContain("");
  });

  it("returns an empty array for a question made only of stopwords", () => {
    expect(extractKeywords("bu ne için ve nasıl?")).toEqual([]);
  });
});
