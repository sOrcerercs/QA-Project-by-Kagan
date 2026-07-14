import { describe, it, expect } from "vitest";
import { canAgentRespond } from "./evaluationResponse";

describe("canAgentRespond", () => {
  it("kendi değerlendirmesi + coaching yapılmışsa izinli", () => {
    expect(canAgentRespond("u1", { agentId: "u1", coachingDone: true })).toBe(true);
  });
  it("coaching yapılmamışsa izinsiz (TL feedback'i öncesi)", () => {
    expect(canAgentRespond("u1", { agentId: "u1", coachingDone: false })).toBe(false);
  });
  it("başka danışmanın değerlendirmesine izinsiz", () => {
    expect(canAgentRespond("u2", { agentId: "u1", coachingDone: true })).toBe(false);
  });
  it("başka kullanıcı + coaching yok → izinsiz", () => {
    expect(canAgentRespond("u2", { agentId: "u1", coachingDone: false })).toBe(false);
  });
});
