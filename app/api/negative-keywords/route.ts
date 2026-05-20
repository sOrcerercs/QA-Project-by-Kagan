import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

function isAuthorized(role: string) {
  return role === "ADMIN" || role === "MANAGER";
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !isAuthorized(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  try {
    const keywords = await prisma.negativeKeyword.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, word: true, createdAt: true },
    });
    return NextResponse.json({ keywords });
  } catch {
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !isAuthorized(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { word } = await req.json().catch(() => ({ word: "" }));
  const normalized = typeof word === "string" ? word.trim().toLowerCase() : "";

  if (!normalized) {
    return NextResponse.json({ error: "Kelime boş olamaz." }, { status: 400 });
  }

  try {
    const keyword = await prisma.negativeKeyword.create({
      data: { word: normalized, createdById: user.id },
      select: { id: true, word: true, createdAt: true },
    });
    return NextResponse.json({ keyword }, { status: 201 });
  } catch (e: any) {
    if (e.code === "P2002") {
      return NextResponse.json({ error: "Bu kelime zaten mevcut." }, { status: 409 });
    }
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
