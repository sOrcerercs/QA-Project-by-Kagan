import { describe, it, expect } from "vitest";
import { safeNextPath } from "./nextPath";

describe("safeNextPath", () => {
  it("geçerli relative path'i döndürür", () => {
    expect(safeNextPath("/evaluation/abc123")).toBe("/evaluation/abc123");
  });

  it("query/nested path'i korur", () => {
    expect(safeNextPath("/evaluation/by-fireflies/01KY?x=1")).toBe("/evaluation/by-fireflies/01KY?x=1");
  });

  it("mutlak URL'yi reddeder (/'e düşer)", () => {
    expect(safeNextPath("https://evil.com")).toBe("/");
    expect(safeNextPath("http://evil.com/x")).toBe("/");
  });

  it("protocol-relative (//) URL'yi reddeder", () => {
    expect(safeNextPath("//evil.com")).toBe("/");
  });

  it("/ ile başlamayanı reddeder", () => {
    expect(safeNextPath("evaluation/abc")).toBe("/");
  });

  it("null/undefined/boş için /'e düşer", () => {
    expect(safeNextPath(null)).toBe("/");
    expect(safeNextPath(undefined)).toBe("/");
    expect(safeNextPath("")).toBe("/");
    expect(safeNextPath("   ")).toBe("/");
  });
});
