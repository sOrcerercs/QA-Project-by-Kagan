import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

// Değerlendirme kaydet
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { agentId, customerName, callDuration, transcript, report, score, callType, promptId, sectionScores, weakCriteria } = await req.json();

  const evaluation = await prisma.evaluation.create({
    data: {
      agentId, customerName, callDuration, transcript, report, score,
      ...(callType && { callType }),
      ...(promptId && { promptId }),
      ...(sectionScores && { sectionScores }),
      ...(weakCriteria && weakCriteria.length > 0 && { weakCriteria }),
    },
    include: { agent: { select: { teamId: true } } },
  });

  // Notify agent
  const notifyIds: string[] = [agentId];

  // Notify team leader if agent belongs to a team
  if (evaluation.agent?.teamId) {
    const team = await prisma.team.findUnique({
      where: { id: evaluation.agent.teamId },
      select: { leaderId: true },
    });
    if (team?.leaderId) notifyIds.push(team.leaderId);
  }

  await prisma.notification.createMany({
    data: notifyIds.map((uid) => ({
      userId: uid,
      type: "EVALUATION",
      message: Array.isArray(weakCriteria) && weakCriteria.length > 0
          ? `${customerName} müşterisi değerlendirmen hazır (%${score}). ${weakCriteria.length} gelişim alanın var.`
          : `${customerName} müşterisi için değerlendirme tamamlandı. Skor: %${score}`,
      referenceId: evaluation.id,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ evaluation });
}

// Değerlendirmeleri getir (rol bazlı, filtreli)
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const params = req.nextUrl.searchParams;
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");
  const agentIdsParam = params.get("agentIds");

  // For TEAM_LEADER, resolve teamId from the team they lead (not user.teamId which may be null)
  let leaderTeamId: string | null = null;
  if (user.role === "TEAM_LEADER") {
    const leadingTeam = await prisma.team.findUnique({
      where: { leaderId: user.id },
      select: { id: true },
    });
    leaderTeamId = leadingTeam?.id ?? null;
    if (!leaderTeamId) {
      return NextResponse.json({ error: "Takım ataması yapılmamış." }, { status: 403 });
    }
  }

  const dateFilter = startDate || endDate ? {
    createdAt: {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate + "T23:59:59.999Z") }),
    },
  } : {};

  let agentIdFilter: string[] | null = null;

  if (agentIdsParam) {
    const requested = agentIdsParam.split(",").filter(Boolean);
    if (user.role === "AGENT") {
      agentIdFilter = [user.id];
    } else if (user.role === "TEAM_LEADER") {
      const teamMembers = await prisma.user.findMany({
        where: { teamId: leaderTeamId! },
        select: { id: true },
      });
      const allowedIds = new Set(teamMembers.map((m) => m.id));
      const filtered = requested.filter(id => allowedIds.has(id));
      if (filtered.length !== requested.length) {
        return NextResponse.json({ error: "Yetkisiz danışman ID'si." }, { status: 403 });
      }
      agentIdFilter = filtered;
    } else {
      agentIdFilter = requested;
    }
  }

  const whereBase: Prisma.EvaluationWhereInput = { ...dateFilter };

  if (user.role === "AGENT") {
    whereBase.agentId = user.id;
  } else if (user.role === "TEAM_LEADER" && !agentIdFilter) {
    const teamMembers = await prisma.user.findMany({
      where: { teamId: leaderTeamId! },
      select: { id: true },
    });
    whereBase.agentId = { in: teamMembers.map((m) => m.id) };
  } else if (agentIdFilter) {
    whereBase.agentId = { in: agentIdFilter };
  }
  // ADMIN/MANAGER with no agentIdFilter intentionally get full access (no agentId restriction)

  const evaluations = await prisma.evaluation.findMany({
    where: whereBase,
    include: { agent: { select: { name: true, email: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ evaluations });
}
