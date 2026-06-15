import { describe, it, expect } from "vitest";
import { matchesForcedFirstCallEmail, FORCED_FIRST_CALL_LEADER_EMAIL } from "./evaluationRules";

describe("matchesForcedFirstCallEmail", () => {
  it("matches the configured leader email, trimmed + case-insensitive", () => {
    expect(matchesForcedFirstCallEmail(FORCED_FIRST_CALL_LEADER_EMAIL)).toBe(true);
    expect(matchesForcedFirstCallEmail("sumeyrademir@estenove.com")).toBe(true);
    expect(matchesForcedFirstCallEmail("  SumeyraDemir@Estenove.COM ")).toBe(true);
  });
  it("does not match other/empty emails", () => {
    expect(matchesForcedFirstCallEmail("someone@estenove.com")).toBe(false);
    expect(matchesForcedFirstCallEmail("")).toBe(false);
    expect(matchesForcedFirstCallEmail(null)).toBe(false);
    expect(matchesForcedFirstCallEmail(undefined)).toBe(false);
  });
});
