import { describe, it, expect } from "vitest";
import { parseCustomRanges } from "./customPeriods";

describe("parseCustomRanges", () => {
  it("2 geçerli aralık", () => {
    expect(parseCustomRanges("2026-05-01:2026-05-31,2026-06-01:2026-06-30")).toEqual([
      { start: "2026-05-01", end: "2026-05-31" },
      { start: "2026-06-01", end: "2026-06-30" },
    ]);
  });
  it("4'ten fazlası 4'e kırpılır", () => {
    const p = ["a:a","b:b","c:c","d:d","e:e"].map((_,i)=>`2026-0${i+1}-01:2026-0${i+1}-28`).join(",");
    expect(parseCustomRanges(p).length).toBe(4);
  });
  it("geçersiz biçim ve start>end elenir", () => {
    expect(parseCustomRanges("bad,2026-06-30:2026-06-01,2026-05-01:2026-05-31")).toEqual([
      { start: "2026-05-01", end: "2026-05-31" },
    ]);
  });
  it("boş/null → []", () => {
    expect(parseCustomRanges("")).toEqual([]);
    expect(parseCustomRanges(null)).toEqual([]);
  });
});
