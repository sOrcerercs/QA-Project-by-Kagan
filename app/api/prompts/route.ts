import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

// Promptları listele
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const callType = req.nextUrl.searchParams.get("callType");

  const prompts = await prisma.prompt.findMany({
    where: callType ? { callType: callType as any } : undefined,
    orderBy: [{ callType: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json({ prompts });
}

// Yeni prompt oluştur
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { name, callType, content, version } = await req.json();

  if (!name || !callType || !content || !version) {
    return NextResponse.json({ error: "Tüm alanlar zorunludur." }, { status: 400 });
  }

  // Aynı callType'ta diğer aktif promptları pasif yap
  await prisma.prompt.updateMany({
    where: { callType, isActive: true },
    data: { isActive: false },
  });

  const prompt = await prisma.prompt.create({
    data: { name, callType, content, version, isActive: true },
  });

  return NextResponse.json({ prompt });
}
