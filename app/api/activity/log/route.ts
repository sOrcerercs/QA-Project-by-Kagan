import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  const { section } = await req.json().catch(() => ({}));
  if (!section) return NextResponse.json({ ok: false }, { status: 400 });

  prisma.activityLog
    .create({ data: { userId: user.id, action: "PAGE_VIEW", section } })
    .catch(() => {});

  return NextResponse.json({ ok: true });
}
