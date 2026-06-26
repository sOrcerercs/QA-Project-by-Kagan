import { describe, it, expect } from "vitest";
import { canEditQa, QA_EDITOR_EMAIL } from "./qaPermissions";

describe("canEditQa", () => {
  it("allows exactly the QA editor email", () => {
    expect(canEditQa(QA_EDITOR_EMAIL)).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(canEditQa("  Admin@Estenove.com ")).toBe(true);
  });

  it("denies any other email", () => {
    expect(canEditQa("manager@estenove.com")).toBe(false);
    expect(canEditQa("someone@else.com")).toBe(false);
  });

  it("denies null/undefined/empty", () => {
    expect(canEditQa(null)).toBe(false);
    expect(canEditQa(undefined)).toBe(false);
    expect(canEditQa("")).toBe(false);
  });
});
