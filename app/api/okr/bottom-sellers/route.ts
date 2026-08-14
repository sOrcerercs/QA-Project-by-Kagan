import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { canViewOkr } from "@/app/lib/okrPermissions";
import { monthRange } from "@/app/lib/okr";

const MAX_SELLERS = 5;

export async function PUT(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!canViewOkr(user.email)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const body = await req.json().catch(() => ({}));
  const month = typeof body?.month === "string" ? body.month : "";
  const rawIds = Array.isArray(body?.userIds) ? body.userIds : null;

  try {
    monthRange(month); // biçim doğrulaması
  } catch {
    return NextResponse.json({ error: "Geçersiz ay." }, { status: 400 });
  }

  if (!rawIds || rawIds.some((id: unknown) => typeof id !== "string")) {
    return NextResponse.json({ error: "userIds bir metin dizisi olmalı." }, { status: 400 });
  }

  const userIds = [...new Set(rawIds as string[])];
  if (userIds.length > MAX_SELLERS) {
    return NextResponse.json({ error: `En fazla ${MAX_SELLERS} kişi seçilebilir.` }, { status: 400 });
  }

  try {
    const existing = await prisma.user.count({ where: { id: { in: userIds } } });
    if (existing !== userIds.length) {
      return NextResponse.json({ error: "Geçersiz kullanıcı." }, { status: 400 });
    }

    await prisma.$transaction([
      prisma.okrBottomSeller.deleteMany({ where: { month } }),
      prisma.okrBottomSeller.createMany({
        data: userIds.map((userId) => ({ month, userId })),
      }),
    ]);

    return NextResponse.json({ ok: true, count: userIds.length });
  } catch (e) {
    console.error("[PUT /api/okr/bottom-sellers]", e);
    return NextResponse.json({ error: "Liste kaydedilemedi." }, { status: 500 });
  }
}
