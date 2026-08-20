import { describe, it, expect } from "vitest";
import { canViewAnalysis, ANALYSIS_VIEWER_EMAIL } from "./analysisPermissions";

describe("canViewAnalysis", () => {
  it("allows exactly the analysis viewer email", () => {
    expect(canViewAnalysis(ANALYSIS_VIEWER_EMAIL)).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(canViewAnalysis("  Admin@Estenove.com ")).toBe(true);
  });

  it("denies other admins and managers", () => {
    expect(canViewAnalysis("manager@estenove.com")).toBe(false);
    expect(canViewAnalysis("admin2@estenove.com")).toBe(false);
    expect(canViewAnalysis("someone@else.com")).toBe(false);
  });

  it("denies null/undefined/empty", () => {
    expect(canViewAnalysis(null)).toBe(false);
    expect(canViewAnalysis(undefined)).toBe(false);
    expect(canViewAnalysis("")).toBe(false);
  });
});
