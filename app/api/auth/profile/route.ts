import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";
import { getUserFromToken } from "@/app/lib/auth";

export async function PATCH(req: NextRequest) {
  const tokenUser = await getUserFromToken(req);
  if (!tokenUser) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const body = await req.json();
  const { name, currentPassword, newPassword } = body as {
    name?: string;
    currentPassword?: string;
    newPassword?: string;
  };

  const user = await prisma.user.findUnique({ where: { id: tokenUser.id } });
  if (!user) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });

  const updates: { name?: string; passwordHash?: string } = {};

  if (name && name.trim() && name.trim() !== user.name) {
    updates.name = name.trim();
  }

  if (newPassword) {
    if (!currentPassword) {
      return NextResponse.json({ error: "Mevcut şifre gerekli." }, { status: 400 });
    }
    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Mevcut şifre hatalı." }, { status: 400 });
    }
    if (newPassword.length < 6) {
      return NextResponse.json({ error: "Yeni şifre en az 6 karakter olmalı." }, { status: 400 });
    }
    updates.passwordHash = await bcrypt.hash(newPassword, 10);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ message: "Değişiklik yok." });
  }

  const updated = await prisma.user.update({ where: { id: user.id }, data: updates });

  const response = NextResponse.json({
    success: true,
    user: { id: updated.id, name: updated.name, email: updated.email, role: updated.role },
  });

  // Regenerate JWT so name update is reflected immediately
  if (updates.name) {
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const token = await new SignJWT({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      role: updated.role,
      teamId: updated.teamId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    response.cookies.set("estenove_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });
  }

  return response;
}
