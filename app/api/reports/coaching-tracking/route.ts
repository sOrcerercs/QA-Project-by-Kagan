import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (user.role !== "ADMIN" && user.role !== "MANAGER") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const startDate = params.get("startDate");
  const endDate = params.get("endDate");

  const dateFilter = startDate || endDate
    ? {
        createdAt: {
          ...(startDate && { gte: new Date(startDate) }),
          ...(endDate && { lte: new Date(endDate + "T23:59:59.999Z") }),
        },
      }
    : {};

  const rows = await prisma.evaluation.findMany({
    where: { ...dateFilter, unassigned: false },
    select: {
      id: true,
      customerName: true,
      callDate: true,
      score: true,
      agentRead: true,
      agentReadAt: true,
      coachingDone: true,
      coachingDoneAt: true,
      coachingNotes: true,
      coachingByName: true,
      agentId: true,
      agent: {
        select: {
          name: true,
          team: { select: { name: true } },
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  // Group by agentId
  const agentMap = new Map<string, {
    agentId: string;
    agentName: string;
    teamName: string | null;
    evaluations: typeof rows;
  }>();

  for (const row of rows) {
    if (!agentMap.has(row.agentId)) {
      agentMap.set(row.agentId, {
        agentId: row.agentId,
        agentName: row.agent.name,
        teamName: row.agent.team?.name ?? null,
        evaluations: [],
      });
    }
    agentMap.get(row.agentId)!.evaluations.push(row);
  }

  const agents = Array.from(agentMap.values()).map((a) => ({
    agentId: a.agentId,
    agentName: a.agentName,
    teamName: a.teamName,
    totalEvals: a.evaluations.length,
    readCount: a.evaluations.filter((e) => e.agentRead).length,
    coachingDoneCount: a.evaluations.filter((e) => e.coachingDone).length,
    evaluations: a.evaluations.map((e) => ({
      id: e.id,
      customerName: e.customerName,
      callDate: e.callDate.toISOString(),
      score: e.score,
      agentRead: e.agentRead,
      agentReadAt: e.agentReadAt?.toISOString() ?? null,
      coachingDone: e.coachingDone,
      coachingDoneAt: e.coachingDoneAt?.toISOString() ?? null,
      coachingNotes: e.coachingNotes ?? null,
      coachingByName: e.coachingByName ?? null,
    })),
  }));

  const totalEvaluations = rows.length;
  const agentReadCount = rows.filter((r) => r.agentRead).length;
  const coachingDoneCount = rows.filter((r) => r.coachingDone).length;

  return NextResponse.json({
    summary: { totalEvaluations, agentReadCount, coachingDoneCount },
    agents,
  });
}
