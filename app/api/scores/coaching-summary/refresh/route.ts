import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  if (user.role === "AGENT") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  let agentId: string | undefined;
  try {
    const body = await req.json();
    agentId = body?.agentId;
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }
  if (!agentId) return NextResponse.json({ error: "agentId zorunlu." }, { status: 400 });

  try {
    await prisma.coachingSummary.upsert({
      where: { agentId },
      create: { agentId, summary: null, evalCount: 0 },
      update: { summary: null },
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[coaching-summary/refresh]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
