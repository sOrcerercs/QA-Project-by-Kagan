import { describe, it, expect } from "vitest";
import { parseCallTypeFilter } from "./callTypeFilter";

describe("parseCallTypeFilter", () => {
  it("FIRST_CALL / SECOND_CALL aynen döner", () => {
    expect(parseCallTypeFilter("FIRST_CALL")).toBe("FIRST_CALL");
    expect(parseCallTypeFilter("SECOND_CALL")).toBe("SECOND_CALL");
  });
  it("boş / null / undefined → undefined (Tümü)", () => {
    expect(parseCallTypeFilter("")).toBeUndefined();
    expect(parseCallTypeFilter(null)).toBeUndefined();
    expect(parseCallTypeFilter(undefined)).toBeUndefined();
  });
  it("filtrede olmayan geçerli enum değerleri → undefined", () => {
    expect(parseCallTypeFilter("FOLLOW_UP")).toBeUndefined();
    expect(parseCallTypeFilter("GENERAL")).toBeUndefined();
  });
  it("geçersiz/çöp değer → undefined", () => {
    expect(parseCallTypeFilter("garbage")).toBeUndefined();
    expect(parseCallTypeFilter("first_call")).toBeUndefined();
  });
});
