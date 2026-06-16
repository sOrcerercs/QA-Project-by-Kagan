import { describe, it, expect } from "vitest";
import { matchEvaluationForRow, type MatchCandidate } from "./qaMatch";

const cands: MatchCandidate[] = [
  { id: "e1", customerName: "Sofonias Biramo", agentName: "Emir Özdemir" },
  { id: "e2", customerName: "Prahlad Ramjeeawon", agentName: "Güney Göç" },
];

describe("matchEvaluationForRow", () => {
  it("matches by normalized customer name, preferring same agent", () => {
    expect(matchEvaluationForRow({ customerName: "sofonias biramo", salesOwner: "Emir Özdemir" }, cands)).toBe("e1");
    expect(matchEvaluationForRow({ customerName: "Prahlad Ramjeeawon", salesOwner: "GUNEY GOC" }, cands)).toBe("e2");
  });
  it("matches despite CRM punctuation/quote noise in the name", () => {
    // Real CRM export style: apostrophe-padded names must still match the clean stored name.
    expect(matchEvaluationForRow({ customerName: "Sofonias' 'Biramo", salesOwner: "Emir Özdemir" }, cands)).toBe("e1");
  });
  it("returns null when no customer-name match", () => {
    expect(matchEvaluationForRow({ customerName: "Nobody Here", salesOwner: "Emir Özdemir" }, cands)).toBeNull();
    expect(matchEvaluationForRow({ customerName: null, salesOwner: "Emir Özdemir" }, cands)).toBeNull();
  });
});
