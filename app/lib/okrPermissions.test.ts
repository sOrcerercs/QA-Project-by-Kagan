import { describe, it, expect } from "vitest";
import { canViewOkr, OKR_VIEWER_EMAIL } from "./okrPermissions";

describe("canViewOkr", () => {
  it("allows exactly the OKR viewer email", () => {
    expect(canViewOkr(OKR_VIEWER_EMAIL)).toBe(true);
  });

  it("is case-insensitive and trims whitespace", () => {
    expect(canViewOkr("  Admin@Estenove.com ")).toBe(true);
  });

  it("denies other admins and managers", () => {
    expect(canViewOkr("manager@estenove.com")).toBe(false);
    expect(canViewOkr("admin2@estenove.com")).toBe(false);
    expect(canViewOkr("someone@else.com")).toBe(false);
  });

  it("denies null/undefined/empty", () => {
    expect(canViewOkr(null)).toBe(false);
    expect(canViewOkr(undefined)).toBe(false);
    expect(canViewOkr("")).toBe(false);
  });
});
