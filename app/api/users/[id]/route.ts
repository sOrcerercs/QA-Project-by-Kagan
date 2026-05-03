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
  const { name, email, role, teamId, newPassword } = body as {
    name?: string;
    email?: string;
    role?: string;
    teamId?: string | null;
    newPassword?: string;
  };

  const updates: Record<string, unknown> = {};
  if (name?.trim()) updates.name = name.trim();
  if (email?.trim()) updates.email = email.trim();
  if (role) updates.role = role;
  if (teamId !== undefined) updates.teamId = teamId || null;
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
