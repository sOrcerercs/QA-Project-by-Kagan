// Ranking rules shared by the leaderboard API.
//
// Only consultants who have reached a minimum number of evaluated calls
// compete for a numbered rank (1, 2, 3 …). Everyone with fewer calls still
// appears in the list — so they can see where they stand — but they are NOT
// assigned a rank, because a handful of calls isn't a fair sample to rank on.
// Unranked rows carry `rank: null` and sort below the ranked group.

export const RANK_MIN_CALLS = 10;

export interface Rankable {
  avgScore: number;
  callCount: number;
}

// Sort `list` by the given score (highest first, call count breaks ties), then
// number only the entries that reached `minCalls`. Ranked entries come first
// (rank 1…n), followed by the unranked ones (rank: null), each group kept in
// score order.
export function rankByScore<T extends Rankable>(
  list: T[],
  scoreOf: (entry: T) => number,
  minCalls: number = RANK_MIN_CALLS
): Array<T & { rank: number | null }> {
  const sorted = [...list].sort(
    (a, b) => scoreOf(b) - scoreOf(a) || b.callCount - a.callCount
  );
  const ranked = sorted.filter((e) => e.callCount >= minCalls);
  const unranked = sorted.filter((e) => e.callCount < minCalls);
  return [
    ...ranked.map((e, i) => ({ ...e, rank: i + 1 as number | null })),
    ...unranked.map((e) => ({ ...e, rank: null as number | null })),
  ];
}
