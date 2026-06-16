import { describe, it, expect } from "vitest";
import { compareValues } from "./SortableTable";

describe("compareValues", () => {
  it("sorts numbers ascending", () => {
    expect(compareValues(1, 2)).toBeLessThan(0);
    expect(compareValues(5, 2)).toBeGreaterThan(0);
    expect(compareValues(-Infinity, 3)).toBeLessThan(0);
  });
  it("sorts strings with Turkish locale", () => {
    expect(compareValues("a", "b")).toBeLessThan(0);
    expect(compareValues("Çağrı", "Zeynep")).toBeLessThan(0); // Ç before Z in tr
  });
});
