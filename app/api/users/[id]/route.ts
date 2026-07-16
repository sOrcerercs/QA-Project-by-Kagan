import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { canEditQa } from "@/app/lib/qaPermissions";
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
  const { name, email, role, teamId, newPassword, managerId, isActive } = body as {
    name?: string;
    email?: string;
    role?: string;
    teamId?: string | null;
    newPassword?: string;
    managerId?: string | null;
    isActive?: boolean;
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
  if (isActive !== undefined) {
    // Aktif/Pasif yönetimi yalnızca admin@estenove.com.
    if (!canEditQa(admin.email)) {
      return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    }
    if (isActive === false) {
      const target = await prisma.user.findUnique({ where: { id }, select: { role: true } });
      if (target?.role === "ADMIN") {
        const activeAdminCount = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
        if (activeAdminCount <= 1) {
          return NextResponse.json({ error: "Son aktif admin pasifleştirilemez." }, { status: 400 });
        }
      }
    }
    updates.isActive = isActive;
  }
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

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const admin = await getUserFromToken(req);
  if (!admin || !["ADMIN", "MANAGER"].includes(admin.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;

  if (id === admin.id) {
    return NextResponse.json({ error: "Kendinizi silemezsiniz." }, { status: 400 });
  }

  const target = await prisma.user.findUnique({ where: { id } });
  if (!target) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

  if (target.role === "ADMIN") {
    const activeAdminCount = await prisma.user.count({ where: { role: "ADMIN", isActive: true } });
    if (activeAdminCount <= 1) {
      return NextResponse.json({ error: "Son admin silinemez." }, { status: 400 });
    }
  }

  await prisma.user.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}
