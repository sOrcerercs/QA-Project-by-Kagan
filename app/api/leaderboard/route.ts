import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const canChoosePeriod = user.role === "ADMIN" || user.role === "MANAGER";
  const raw = req.nextUrl.searchParams.get("period") ?? "30d";
  const period = canChoosePeriod && ["30d", "3m", "all"].includes(raw) ? raw : "30d";

  const now = new Date();
  let dateFilter: { callDate?: { gte: Date } } = {};
  if (period === "30d") {
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    dateFilter = { callDate: { gte: from } };
  } else if (period === "3m") {
    const from = new Date(now);
    from.setDate(from.getDate() - 90);
    dateFilter = { callDate: { gte: from } };
  }

  try {
    const agents = await prisma.user.findMany({
      where: { role: "AGENT" },
      select: { id: true, name: true, team: { select: { id: true, name: true } } },
    });

    const scored = await Promise.all(
      agents.map(async (agent) => {
        const evals = await prisma.evaluation.findMany({
          where: { agentId: agent.id, ...dateFilter },
          select: { score: true, sectionScores: true },
        });
        if (evals.length === 0) return null;

        const avgScore = Math.round(
          evals.reduce((s, e) => s + e.score, 0) / evals.length
        );

        const evalsWithSections = evals.filter(
          (e) => e.sectionScores && typeof e.sectionScores === "object"
        );
        let sectionScores: { A: number; B: number; C: number } | null = null;
        if (evalsWithSections.length > 0) {
          const totals = evalsWithSections.reduce(
            (acc, e) => {
              const ss = e.sectionScores as { A: number; B: number; C: number };
              return { A: acc.A + (ss.A || 0), B: acc.B + (ss.B || 0), C: acc.C + (ss.C || 0) };
            },
            { A: 0, B: 0, C: 0 }
          );
          const n = evalsWithSections.length;
          sectionScores = {
            A: Math.round(totals.A / n),
            B: Math.round(totals.B / n),
            C: Math.round(totals.C / n),
          };
        }

        return {
          agentId: agent.id,
          name: agent.name,
          teamId: agent.team?.id ?? null,
          teamName: agent.team?.name ?? null,
          avgScore,
          callCount: evals.length,
          sectionScores,
        };
      })
    );

    const valid = scored.filter(
      (x): x is NonNullable<typeof x> => x !== null
    );
    valid.sort((a, b) => b.avgScore - a.avgScore || b.callCount - a.callCount);

    const limit = canChoosePeriod ? valid.length : 5;
    const entries = valid.slice(0, limit).map((entry, i) => ({
      rank: i + 1,
      ...entry,
    }));

    // Team leaderboard — all teams with at least one evaluated agent
    const teamMap: Record<string, { teamName: string; totalScore: number; agentCount: number }> = {};
    for (const agent of valid) {
      if (!agent.teamId) continue;
      if (!teamMap[agent.teamId]) {
        teamMap[agent.teamId] = { teamName: agent.teamName!, totalScore: 0, agentCount: 0 };
      }
      teamMap[agent.teamId].totalScore += agent.avgScore;
      teamMap[agent.teamId].agentCount += 1;
    }
    const teams = Object.entries(teamMap)
      .map(([teamId, t]) => ({
        teamId,
        teamName: t.teamName,
        avgScore: Math.round(t.totalScore / t.agentCount),
        agentCount: t.agentCount,
      }))
      .sort((a, b) => b.avgScore - a.avgScore || b.agentCount - a.agentCount)
      .map((t, i) => ({ rank: i + 1, ...t }));

    return NextResponse.json({
      entries,
      teams,
      period,
      totalAgents: valid.length,
    });
  } catch (err) {
    console.error("[leaderboard]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
