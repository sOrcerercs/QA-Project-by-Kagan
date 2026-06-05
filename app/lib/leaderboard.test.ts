import { describe, it, expect } from "vitest";
import { rankByScore, RANK_MIN_CALLS } from "./leaderboard";

interface Row {
  name: string;
  avgScore: number;
  callCount: number;
  sectionScores?: { A: number; B: number; C: number };
}

const row = (name: string, avgScore: number, callCount: number): Row => ({
  name,
  avgScore,
  callCount,
});

describe("rankByScore", () => {
  it("numbers only entries that reached the minimum call count", () => {
    const out = rankByScore(
      [row("A", 90, 12), row("B", 80, 5), row("C", 85, 20)],
      (e) => e.avgScore
    );
    const ranks = Object.fromEntries(out.map((e) => [e.name, e.rank]));
    expect(ranks).toEqual({ A: 1, C: 2, B: null });
  });

  it("places unranked entries below all ranked ones, regardless of score", () => {
    const out = rankByScore(
      [row("HighFewCalls", 99, 3), row("Solid", 70, 15)],
      (e) => e.avgScore
    );
    expect(out.map((e) => e.name)).toEqual(["Solid", "HighFewCalls"]);
    expect(out[0].rank).toBe(1);
    expect(out[1].rank).toBeNull();
  });

  it("ranks the ranked group by score, then call count as a tiebreaker", () => {
    const out = rankByScore(
      [row("Tie1", 80, 11), row("Tie2", 80, 25), row("Top", 95, 10)],
      (e) => e.avgScore
    );
    expect(out.map((e) => e.name)).toEqual(["Top", "Tie2", "Tie1"]);
    expect(out.map((e) => e.rank)).toEqual([1, 2, 3]);
  });

  it("keeps unranked entries sorted by score among themselves", () => {
    const out = rankByScore(
      [row("LowFew", 60, 2), row("HighFew", 88, 9)],
      (e) => e.avgScore
    );
    expect(out.map((e) => e.name)).toEqual(["HighFew", "LowFew"]);
    expect(out.every((e) => e.rank === null)).toBe(true);
  });

  it("treats exactly the threshold as ranked", () => {
    const out = rankByScore([row("AtThreshold", 50, RANK_MIN_CALLS)], (e) => e.avgScore);
    expect(out[0].rank).toBe(1);
  });

  it("supports an arbitrary score selector (section scores)", () => {
    const data = [
      { name: "X", avgScore: 0, callCount: 12, sectionScores: { A: 70, B: 0, C: 0 } },
      { name: "Y", avgScore: 0, callCount: 30, sectionScores: { A: 90, B: 0, C: 0 } },
    ];
    const out = rankByScore(data, (e) => e.sectionScores!.A);
    expect(out.map((e) => e.name)).toEqual(["Y", "X"]);
    expect(out.map((e) => e.rank)).toEqual([1, 2]);
  });

  it("returns an empty array unchanged", () => {
    expect(rankByScore([] as Row[], (e) => e.avgScore)).toEqual([]);
  });
});
