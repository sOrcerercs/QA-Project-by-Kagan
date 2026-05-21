import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import bcrypt from "bcryptjs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getUserFromToken(req);
  if (!admin || !["ADMIN", "MANAGER"].includes(admin.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;
  const user = await prisma.user.findUnique({
    where: { id },
    include: { team: true },
  });

  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

  const { passwordHash: _, ...safeUser } = user;
  return NextResponse.json({ user: safeUser });
}

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getUserFromToken(req);
  if (!admin || !["ADMIN", "MANAGER"].includes(admin.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const { name, email, role, teamId, newPassword, managerId } = body as {
    name?: string;
    email?: string;
    role?: string;
    teamId?: string | null;
    newPassword?: string;
    managerId?: string | null;
  };

  // MANAGER can only assign themselves as manager (null also blocked)
  if (admin.role === "MANAGER" && managerId !== undefined && managerId !== admin.id) {
    return NextResponse.json({ error: "Yöneticiler yalnızca kendilerini atayabilir." }, { status: 403 });
  }

  // Prevent self-assignment (a user cannot be their own manager)
  if (managerId !== undefined && managerId !== null && managerId === id) {
    return NextResponse.json({ error: "Kullanıcı kendisinin müdürü olamaz." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (name?.trim()) updates.name = name.trim();
  if (email?.trim()) updates.email = email.trim();
  if (role) updates.role = role;
  if (teamId !== undefined) updates.teamId = teamId || null;
  if (managerId !== undefined) {
    // Clear managerId when role is explicitly set to non-TEAM_LEADER
    if (role && role !== "TEAM_LEADER") {
      updates.managerId = null;
    } else {
      updates.managerId = managerId;
    }
  }
  if (newPassword) {
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Şifre en az 6 karakter olmalı." }, { status: 400 });
    }
    updates.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "Değişiklik yok." });
  }

  const updated = await prisma.user.update({ where: { id }, data: updates, include: { team: true } });
  const { passwordHash: _, ...safeUser } = updated;
  return NextResponse.json({ user: safeUser });
}
