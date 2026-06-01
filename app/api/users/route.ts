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

  try {
    const users = await prisma.user.findMany({
      where: { isActive: true },
      include: {
        team: true,
        manager: { select: { id: true, name: true } },
      },
      orderBy: { name: "asc" },
    });
    return NextResponse.json({ users });
  } catch (e) {
    console.error("[GET /api/users]", e);
    return NextResponse.json({ error: "Kullanıcılar yüklenemedi." }, { status: 500 });
  }
}

// Yeni kullanıcı ekle
export async function POST(req: NextRequest) {
  const currentUser = await getUserFromToken(req);
  if (!currentUser || !["ADMIN", "MANAGER"].includes(currentUser.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { name, email, password, role, teamId, leaderId, managerId } = await req.json();

  // MANAGER can only create AGENT or TEAM_LEADER accounts
  if (currentUser.role === "MANAGER" && !["AGENT", "TEAM_LEADER"].includes(role)) {
    return NextResponse.json({ error: "Yöneticiler sadece Danışman veya Takım Lideri hesabı oluşturabilir." }, { status: 403 });
  }

  // MANAGER can only assign themselves as manager for a TL
  if (
    currentUser.role === "MANAGER" &&
    managerId !== undefined &&
    managerId !== currentUser.id
  ) {
    return NextResponse.json({ error: "Yöneticiler yalnızca kendilerini atayabilir." }, { status: 403 });
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10);

    // Pasif kullanıcıyı yeniden aktif et
    const existingInactive = await prisma.user.findFirst({ where: { email, isActive: false } });
    if (existingInactive) {
      let resolvedTeamId: string | null = teamId || null;
      if (leaderId) {
        const leader = await prisma.user.findUnique({ where: { id: leaderId }, include: { leadingTeam: true } });
        if (leader) {
          resolvedTeamId = leader.leadingTeam?.id ?? (await prisma.team.create({ data: { name: `${leader.name}'in Takımı`, leaderId: leader.id } })).id;
        }
      }
      const reactivated = await prisma.user.update({
        where: { id: existingInactive.id },
        data: { name, passwordHash, role, teamId: resolvedTeamId, managerId: role === "TEAM_LEADER" ? (managerId ?? null) : null, mustChangePassword: true, isActive: true },
      });
      return NextResponse.json({ user: reactivated });
    }

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
      data: {
        name,
        email,
        passwordHash,
        role,
        teamId: resolvedTeamId,
        managerId: role === "TEAM_LEADER" ? (managerId ?? null) : null,
        mustChangePassword: true,
      },
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
  } catch (e: any) {
    console.error("[POST /api/users]", e);
    if (e?.code === "P2002") {
      return NextResponse.json({ error: "Bu e-posta adresi zaten kullanımda." }, { status: 409 });
    }
    return NextResponse.json({ error: "Kullanıcı oluşturulamadı." }, { status: 500 });
  }
}
