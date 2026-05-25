import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const q = req.nextUrl.searchParams.get("q")?.trim() ?? "";
  if (q.length < 2) {
    return NextResponse.json({ error: "En az 2 karakter girin." }, { status: 400 });
  }

  let agentWhere: Record<string, unknown> = {};

  if (user.role === "AGENT") {
    agentWhere = { agentId: user.id };
  } else if (user.role === "TEAM_LEADER") {
    const leadingTeam = await prisma.team.findUnique({
      where: { leaderId: user.id },
      select: { id: true },
    });
    if (!leadingTeam) {
      return NextResponse.json({ error: "Takım ataması yapılmamış." }, { status: 403 });
    }
    const members = await prisma.user.findMany({
      where: { teamId: leadingTeam.id },
      select: { id: true },
    });
    agentWhere = { agentId: { in: [user.id, ...members.map((m) => m.id)] } };
  }

  const results = await prisma.evaluation.findMany({
    where: {
      ...agentWhere,
      OR: [
        { customerName: { contains: q, mode: "insensitive" } },
        { transcript: { contains: q, mode: "insensitive" } },
      ],
    },
    select: {
      id: true,
      customerName: true,
      callType: true,
      score: true,
      callDate: true,
      createdAt: true,
      agent: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 50,
  });

  return NextResponse.json({ results });
}
