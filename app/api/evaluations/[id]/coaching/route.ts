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

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    select: { id: true, agentId: true, customerName: true },
  });
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

  // Coaching kaydedildiğinde danışmana bildirim (kendine bildirim gönderme).
  if (done && evaluation.agentId !== user.id) {
    try {
      await prisma.notification.create({
        data: {
          userId: evaluation.agentId,
          type: "COACHING",
          message: `${user.name}, ${evaluation.customerName} görüşmen için coaching notu ekledi.`,
          referenceId: id,
        },
      });
    } catch (e) {
      console.warn("[coaching] bildirim oluşturulamadı:", e);
    }
  }

  return NextResponse.json(updated);
}
