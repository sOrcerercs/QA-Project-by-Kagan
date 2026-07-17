import { describe, it, expect } from "vitest";
import { matchEvaluationForRow, type MatchCandidate } from "./qaMatch";

const cands: MatchCandidate[] = [
  { id: "e1", customerName: "Sofonias Biramo", agentName: "Emir Özdemir" },
  { id: "e2", customerName: "Prahlad Ramjeeawon", agentName: "Güney Göç" },
];

describe("matchEvaluationForRow", () => {
  it("matches when both customer name AND agent match", () => {
    expect(matchEvaluationForRow({ customerName: "sofonias biramo", salesOwner: "Emir Özdemir" }, cands)).toBe("e1");
    expect(matchEvaluationForRow({ customerName: "Prahlad Ramjeeawon", salesOwner: "GUNEY GOC" }, cands)).toBe("e2");
  });

  it("matches despite CRM punctuation/quote noise in the name", () => {
    // Real CRM export style: apostrophe-padded names must still match the clean stored name.
    expect(matchEvaluationForRow({ customerName: "Sofonias' 'Biramo", salesOwner: "Emir Özdemir" }, cands)).toBe("e1");
  });

  it("matches across Türkçe I and x/ks spelling variants (shared agent-name folding)", () => {
    const trCands: MatchCandidate[] = [
      { id: "e3", customerName: "Müşteri Bir", agentName: "Faızan Ishaque" },   // stored: dotless ı
      { id: "e4", customerName: "Müşteri İki", agentName: "Alexandra Boyko" },  // stored: x
    ];
    // CRM sends the other spelling variant; auto-match must still bind.
    expect(matchEvaluationForRow({ customerName: "Müşteri Bir", salesOwner: "faızan ıshaque" }, trCands)).toBe("e3");
    expect(matchEvaluationForRow({ customerName: "Müşteri İki", salesOwner: "Aleksandra Boyko" }, trCands)).toBe("e4");
  });

  it("returns null when the customer matches but the agent does not (no wrong auto-match)", () => {
    expect(matchEvaluationForRow({ customerName: "Sofonias Biramo", salesOwner: "Someone Else" }, cands)).toBeNull();
  });

  it("returns null when the agent matches but the customer does not", () => {
    expect(matchEvaluationForRow({ customerName: "Different Customer", salesOwner: "Emir Özdemir" }, cands)).toBeNull();
  });

  it("returns null when salesOwner is missing or empty (agent now required)", () => {
    expect(matchEvaluationForRow({ customerName: "Sofonias Biramo", salesOwner: null }, cands)).toBeNull();
    expect(matchEvaluationForRow({ customerName: "Sofonias Biramo", salesOwner: "" }, cands)).toBeNull();
  });

  it("returns null when there is no customer-name match", () => {
    expect(matchEvaluationForRow({ customerName: "Nobody Here", salesOwner: "Emir Özdemir" }, cands)).toBeNull();
    expect(matchEvaluationForRow({ customerName: null, salesOwner: "Emir Özdemir" }, cands)).toBeNull();
  });
});
