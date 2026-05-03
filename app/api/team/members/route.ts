import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

// Takım üyelerini getir
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!["TEAM_LEADER", "ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  let teamId: string | null;
  if (user.role === "TEAM_LEADER") {
    const leadingTeam = await prisma.team.findUnique({
      where: { leaderId: user.id },
      select: { id: true },
    });
    teamId = leadingTeam?.id ?? null;
    if (!teamId) return NextResponse.json({ error: "Takım ataması bulunamadı." }, { status: 400 });
  } else {
    const leaderId = req.nextUrl.searchParams.get("leaderId");
    teamId = req.nextUrl.searchParams.get("teamId");
    if (leaderId && !teamId) {
      const leadingTeam = await prisma.team.findUnique({
        where: { leaderId },
        select: { id: true },
      });
      teamId = leadingTeam?.id ?? null;
    }
    if (!teamId) return NextResponse.json({ error: "teamId veya leaderId gerekli." }, { status: 400 });
  }

  const members = await prisma.user.findMany({
    where: { teamId },
    select: { id: true, name: true, role: true, email: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ members });
}
