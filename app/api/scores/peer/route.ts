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
  if (!["AGENT", "TEAM_LEADER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  // Determine team members
  let teamMembers: { id: string }[] = [];
  if (user.role === "AGENT" && user.teamId) {
    const team = await prisma.team.findUnique({
      where: { id: user.teamId },
      select: { members: { select: { id: true } } },
    });
    teamMembers = team?.members ?? [];
  } else if (user.role === "TEAM_LEADER") {
    // Team members excludes the leader themselves (separate DB relation),
    // so team avg is purely the direct reports' average.
    const team = await prisma.team.findUnique({
      where: { leaderId: user.id },
      select: { members: { select: { id: true } } },
    });
    teamMembers = team?.members ?? [];
  }

  const hasTeam = teamMembers.length > 0;

  // My evaluations
  const myEvals = await prisma.evaluation.findMany({
    where: { agentId: user.id },
    select: { score: true, sectionScores: true, weakCriteria: true },
  });

  const mineOverallAvg = avg(myEvals.map(e => e.score));
  const mineSectionAvg = sectionAvgFromEvals(myEvals);
  const mineCallCount = myEvals.length;

  // Build my criteria map (only items with section field, count >= 2)
  const myCriteriaMap: Record<
    string,
    { label: string; section: string; totalScore: number; count: number }
  > = {};
  myEvals.forEach(e => {
    if (!Array.isArray(e.weakCriteria)) return;
    (
      e.weakCriteria as Array<{
        id: string;
        label: string;
        score: number;
        section?: string;
      }>
    ).forEach(c => {
      if (!c.section) return;
      if (!myCriteriaMap[c.id]) {
        myCriteriaMap[c.id] = {
          label: c.label,
          section: c.section,
          totalScore: 0,
          count: 0,
        };
      }
      myCriteriaMap[c.id].totalScore += c.score;
      myCriteriaMap[c.id].count += 1;
    });
  });

  let teamData: {
    overallAvg: number;
    sectionAvg: { A: number; B: number; C: number } | null;
    callCountAvg: number;
  } | null = null;

  let criteriaBreakdown: Array<{
    id: string;
    label: string;
    section: string;
    mine: number;
    teamAvg: number;
    delta: number;
  }> = [];

  if (hasTeam) {
    const teamIds = teamMembers.map(m => m.id);

    const allTeamEvals = await prisma.evaluation.findMany({
      where: { agentId: { in: teamIds } },
      select: { score: true, sectionScores: true, weakCriteria: true },
    });

    const teamCriteriaMap: Record<
      string,
      { totalScore: number; count: number }
    > = {};
    allTeamEvals.forEach(e => {
      if (!Array.isArray(e.weakCriteria)) return;
      (
        e.weakCriteria as Array<{
          id: string;
          score: number;
          section?: string;
        }>
      ).forEach(c => {
        if (!c.section) return;
        if (!teamCriteriaMap[c.id]) teamCriteriaMap[c.id] = { totalScore: 0, count: 0 };
        teamCriteriaMap[c.id].totalScore += c.score;
        teamCriteriaMap[c.id].count += 1;
      });
    });

    criteriaBreakdown = Object.entries(myCriteriaMap)
      .filter(([, v]) => v.count >= 2)
      .flatMap(([id, v]) => {
        const teamEntry = teamCriteriaMap[id];
        if (!teamEntry) return [];
        const mineAvg = Math.round(v.totalScore / v.count);
        const teamAvg = Math.round(teamEntry.totalScore / teamEntry.count);
        return [{
          id,
          label: v.label,
          section: v.section,
          mine: mineAvg,
          teamAvg,
          delta: mineAvg - teamAvg,
        }];
      });

    teamData = {
      overallAvg: avg(allTeamEvals.map(e => e.score)),
      sectionAvg: sectionAvgFromEvals(allTeamEvals),
      callCountAvg: Math.round(allTeamEvals.length / teamIds.length),
    };
  }

  return NextResponse.json({
    mine: {
      overallAvg: mineOverallAvg,
      sectionAvg: mineSectionAvg,
      callCount: mineCallCount,
      criteriaBreakdown,
    },
    team: teamData,
    teamSize: teamMembers.length,
    hasTeam,
  });
}
