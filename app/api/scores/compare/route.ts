import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

function avg(nums: number[]): number {
  if (nums.length === 0) return 0;
  return Math.round(nums.reduce((s, n) => s + n, 0) / nums.length);
}

function sectionAvgFromEvals(
  evals: { sectionScores: unknown }[]
): { A: number; B: number; C: number } | null {
  const withSections = evals.filter(e => e.sectionScores);
  if (withSections.length === 0) return null;
  const totals = withSections.reduce(
    (acc, e) => {
      const ss = e.sectionScores as { A: number; B: number; C: number };
      return {
        A: acc.A + (ss?.A ?? 0),
        B: acc.B + (ss?.B ?? 0),
        C: acc.C + (ss?.C ?? 0),
      };
    },
    { A: 0, B: 0, C: 0 }
  );
  const n = withSections.length;
  return {
    A: Math.round(totals.A / n),
    B: Math.round(totals.B / n),
    C: Math.round(totals.C / n),
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const teamIdsParam = req.nextUrl.searchParams.get("teamIds") || "";
  const agentIdsParam = req.nextUrl.searchParams.get("agentIds") || "";

  // All teams for selector
  const allTeams = await prisma.team.findMany({
    select: {
      id: true,
      name: true,
      members: { select: { id: true } },
    },
  });
  const teams = allTeams.map(t => ({
    id: t.id,
    name: t.name,
    memberCount: t.members.length,
  }));

  const targetTeamIds: string[] =
    teamIdsParam
      ? teamIdsParam.split(",").filter(Boolean)
      : allTeams.map(t => t.id);

  const agentIdFilter = agentIdsParam
    ? agentIdsParam.split(",").filter(Boolean)
    : null;

  const agents = await prisma.user.findMany({
    where: {
      role: "AGENT",
      isActive: true,
      teamId: { in: targetTeamIds },
      ...(agentIdFilter ? { id: { in: agentIdFilter } } : {}),
    },
    select: {
      id: true,
      name: true,
      teamId: true,
      team: { select: { name: true } },
    },
  });

  const agentResults = await Promise.all(
    agents.map(async a => {
      const evals = await prisma.evaluation.findMany({
        where: { agentId: a.id },
        select: { score: true, sectionScores: true },
      });
      return {
        id: a.id,
        name: a.name,
        teamId: a.teamId ?? "",
        teamName: a.team?.name ?? "Takımsız",
        overallAvg: avg(evals.map(e => e.score)),
        sectionAvg: sectionAvgFromEvals(evals),
        callCount: evals.length,
      };
    })
  );

  agentResults.sort((a, b) => b.overallAvg - a.overallAvg);

  const aggregateOverallAvg = avg(agentResults.map(a => a.overallAvg));
  const callCountAvg =
    agentResults.length > 0
      ? Math.round(
          agentResults.reduce((s, a) => s + a.callCount, 0) /
            agentResults.length
        )
      : 0;

  const agentsWithSections = agentResults.filter(a => a.sectionAvg);
  const aggregateSectionAvg =
    agentsWithSections.length > 0
      ? {
          A: Math.round(
            agentsWithSections.reduce((s, a) => s + a.sectionAvg!.A, 0) /
              agentsWithSections.length
          ),
          B: Math.round(
            agentsWithSections.reduce((s, a) => s + a.sectionAvg!.B, 0) /
              agentsWithSections.length
          ),
          C: Math.round(
            agentsWithSections.reduce((s, a) => s + a.sectionAvg!.C, 0) /
              agentsWithSections.length
          ),
        }
      : null;

  return NextResponse.json({
    agents: agentResults,
    aggregate: {
      overallAvg: aggregateOverallAvg,
      sectionAvg: aggregateSectionAvg,
      callCountAvg,
      agentCount: agentResults.length,
    },
    teams,
  });
}
