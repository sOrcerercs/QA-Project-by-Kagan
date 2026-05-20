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
      select: { id: true, name: true, team: { select: { name: true } } },
    });

    const scored = await Promise.all(
      agents.map(async (agent) => {
        const evals = await prisma.evaluation.findMany({
          where: { agentId: agent.id, ...dateFilter },
          select: { score: true },
        });
        if (evals.length === 0) return null;
        const avgScore = Math.round(
          evals.reduce((s, e) => s + e.score, 0) / evals.length
        );
        return {
          agentId: agent.id,
          name: agent.name,
          teamName: agent.team?.name ?? null,
          avgScore,
          callCount: evals.length,
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

    return NextResponse.json({
      entries,
      period,
      totalAgents: valid.length,
    });
  } catch (err) {
    console.error("[leaderboard]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
