import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { parseCallTypeFilter } from "@/app/lib/callTypeFilter";

// Değerlendirme kaydet
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { agentId, customerName, callDuration, transcript, report, score, callType, promptId, sectionScores, weakCriteria, reportData } = await req.json();

  // Duplicate guard: same agent + same transcript → update instead of create
  const transcriptPrefix = typeof transcript === "string" ? transcript.slice(0, 300) : "";
  const existing = transcriptPrefix
    ? await prisma.evaluation.findFirst({
        where: {
          agentId,
          transcript: { startsWith: transcriptPrefix },
        },
        select: { id: true, agent: { select: { teamId: true } } },
      })
    : null;

  const evaluation = existing
    ? await prisma.evaluation.update({
        where: { id: existing.id },
        data: {
          customerName, callDuration, report, score,
          ...(callType && { callType }),
          ...(promptId && { promptId }),
          ...(sectionScores && { sectionScores }),
          ...(weakCriteria && weakCriteria.length > 0 && { weakCriteria }),
          ...(reportData && { reportData }),
        },
        include: { agent: { select: { teamId: true } } },
      })
    : await prisma.evaluation.create({
        data: {
          agentId, customerName, callDuration, transcript, report, score,
          ...(callType && { callType }),
          ...(promptId && { promptId }),
          ...(sectionScores && { sectionScores }),
          ...(weakCriteria && weakCriteria.length > 0 && { weakCriteria }),
          ...(reportData && { reportData }),
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
  const callType = parseCallTypeFilter(params.get("callType"));
  const teamId = params.get("teamId");

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
    callDate: {
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
      const allowedIds = new Set([...teamMembers.map((m) => m.id), user.id]);
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
  if (callType) whereBase.callType = callType;
  // Takım filtresi: değerlendirilen danışmanın takımına göre daralt (ADMIN/MANAGER).
  // Rol scoping'iyle (agentId) AND'lenir; TEAM_LEADER'a UI'da gösterilmez.
  if (teamId) whereBase.agent = { teamId };

  if (user.role === "AGENT") {
    whereBase.agentId = user.id;
  } else if (user.role === "TEAM_LEADER" && !agentIdFilter) {
    const teamMembers = await prisma.user.findMany({
      where: { teamId: leaderTeamId! },
      select: { id: true },
    });
    whereBase.agentId = { in: [...teamMembers.map((m) => m.id), user.id] };
  } else if (agentIdFilter) {
    whereBase.agentId = { in: agentIdFilter };
  }
  // ADMIN/MANAGER with no agentIdFilter intentionally get full access (no agentId restriction)

  // Liste yalnızca hafif alanları çeker (transcript ~20MB / report ~40MB gibi ağır
  // alanları DEĞİL). report yalnızca export için, ?withReport=1 ile opt-in gelir.
  const withReport = params.get("withReport") === "1";
  const evaluations = await prisma.evaluation.findMany({
    where: whereBase,
    select: {
      id: true,
      score: true,
      customerName: true,
      callDuration: true,
      callDate: true,
      createdAt: true,
      callType: true,
      agentRead: true,
      agentReadAt: true,
      coachingDone: true,
      coachingDoneAt: true,
      coachingByName: true,
      agent: { select: { name: true } },
      ...(withReport ? { report: true } : {}),
    },
    orderBy: { callDate: "desc" },
  });

  return NextResponse.json({ evaluations });
}

// Değerlendirmeleri sil (toplu silme)
export async function DELETE(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  const body = await req.json();

  if (body.all === true) {
    const result = await prisma.evaluation.deleteMany({});
    return NextResponse.json({ deleted: result.count });
  }

  if (Array.isArray(body.ids) && body.ids.length > 0) {
    const result = await prisma.evaluation.deleteMany({
      where: { id: { in: body.ids } },
    });
    return NextResponse.json({ deleted: result.count });
  }

  return NextResponse.json({ error: "Geçersiz istek." }, { status: 400 });
}
