import { NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import bcrypt from "bcryptjs";
import { SignJWT } from "jose";

export async function POST(request: Request) {
  try {
    const { email, password } = await request.json();

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 401 });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      return NextResponse.json({ error: "Hatalı şifre." }, { status: 401 });
    }

    const jwtSecret = process.env.JWT_SECRET;
    if (!jwtSecret) {
      console.error("[login] JWT_SECRET is not configured");
      return NextResponse.json({ error: "Sunucu yapılandırma hatası." }, { status: 500 });
    }
    const secret = new TextEncoder().encode(jwtSecret);
    const token = await new SignJWT({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      teamId: user.teamId,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setExpirationTime("7d")
      .sign(secret);

    // Activity log + lastLoginAt (fire-and-forget)
    prisma.activityLog.create({ data: { userId: user.id, action: "LOGIN" } })
      .catch(err => console.error("[login] activityLog write failed:", err));
    prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } })
      .catch(err => console.error("[login] lastLoginAt update failed:", err));

    const response = NextResponse.json({
      success: true,
      user: { id: user.id, name: user.name, role: user.role },
    });

    response.cookies.set("estenove_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 60 * 60 * 24 * 7,
      path: "/",
    });

    return response;
  } catch (error: any) {
    console.error("[login] Unexpected error:", error);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
