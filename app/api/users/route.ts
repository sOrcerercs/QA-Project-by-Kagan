import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import bcrypt from "bcryptjs";

// Kullanıcıları getir
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const users = await prisma.user.findMany({
    include: { team: true },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ users });
}

// Yeni kullanıcı ekle
export async function POST(req: NextRequest) {
  const currentUser = await getUserFromToken(req);
  if (!currentUser || !["ADMIN", "MANAGER"].includes(currentUser.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { name, email, password, role, teamId, leaderId } = await req.json();

  const passwordHash = await bcrypt.hash(password, 10);

  let resolvedTeamId: string | null = teamId || null;

  if (leaderId) {
    const leader = await prisma.user.findUnique({
      where: { id: leaderId },
      include: { leadingTeam: true },
    });

    if (leader) {
      if (leader.leadingTeam) {
        resolvedTeamId = leader.leadingTeam.id;
      } else {
        const newTeam = await prisma.team.create({
          data: { name: `${leader.name}'in Takımı`, leaderId: leader.id },
        });
        resolvedTeamId = newTeam.id;
      }
    }
  }

  const newUser = await prisma.user.create({
    data: { name, email, passwordHash, role, teamId: resolvedTeamId },
  });

  // TEAM_LEADER oluşturulduğunda otomatik takım kur (henüz bir takım yoksa)
  if (role === "TEAM_LEADER") {
    const existing = await prisma.team.findUnique({ where: { leaderId: newUser.id } });
    if (!existing) {
      await prisma.team.create({
        data: { name: `${name}'in Takımı`, leaderId: newUser.id },
      });
    }
  }

  return NextResponse.json({ user: newUser });
}
