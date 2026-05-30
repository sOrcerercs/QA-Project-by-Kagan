import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  if (!["TEAM_LEADER", "ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;

  const evaluation = await prisma.evaluation.findUnique({ where: { id }, select: { id: true } });
  if (!evaluation) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  const body = await req.json();
  const done: boolean = !!body.done;
  const notes: string = typeof body.notes === "string" ? body.notes.trim() : "";

  const updated = await prisma.evaluation.update({
    where: { id },
    data: {
      coachingDone: done,
      coachingDoneAt: done ? new Date() : null,
      coachingNotes: done ? (notes || null) : null,
      coachingById: user.id,
      coachingByName: user.name,
    },
    select: {
      coachingDone: true,
      coachingDoneAt: true,
      coachingNotes: true,
      coachingByName: true,
    },
  });

  return NextResponse.json(updated);
}
