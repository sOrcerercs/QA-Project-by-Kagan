import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { canAgentRespond } from "@/app/lib/evaluationResponse";
import { QA_EDITOR_EMAIL } from "@/app/lib/qaPermissions";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { id } = await params;
  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    select: { id: true, agentId: true, coachingDone: true, agent: { select: { teamId: true, name: true } } },
  });
  if (!evaluation) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  if (!canAgentRespond(user.id, evaluation)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const body = await req.json();
  const text: string = typeof body.text === "string" ? body.text.trim() : "";
  if (!text) return NextResponse.json({ error: "İtiraz metni boş olamaz." }, { status: 400 });

  const updated = await prisma.evaluation.update({
    where: { id },
    data: { objectionText: text, objectionAt: new Date() },
    select: { objectionText: true, objectionAt: true },
  });

  // Alıcılar: takım lideri + admin@estenove.com (tekilleştir)
  const notifyIds: string[] = [];
  if (evaluation.agent?.teamId) {
    const team = await prisma.team.findUnique({
      where: { id: evaluation.agent.teamId },
      select: { leaderId: true },
    });
    if (team?.leaderId) notifyIds.push(team.leaderId);
  }
  const admin = await prisma.user.findUnique({
    where: { email: QA_EDITOR_EMAIL },
    select: { id: true },
  });
  if (admin) notifyIds.push(admin.id);

  const uniqueIds = [...new Set(notifyIds)];
  if (uniqueIds.length) {
    await prisma.notification.createMany({
      data: uniqueIds.map((uid) => ({
        userId: uid,
        type: "OBJECTION",
        message: `${evaluation.agent.name} bir değerlendirmeye itiraz etti.`,
        referenceId: id,
      })),
      skipDuplicates: true,
    });
  }

  return NextResponse.json(updated);
}
