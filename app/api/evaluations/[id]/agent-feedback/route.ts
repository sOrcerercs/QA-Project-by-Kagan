import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { canAgentRespond } from "@/app/lib/evaluationResponse";

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
  const feedback: string = typeof body.feedback === "string" ? body.feedback.trim() : "";
  if (!feedback) return NextResponse.json({ error: "Geri bildirim boş olamaz." }, { status: 400 });

  const updated = await prisma.evaluation.update({
    where: { id },
    data: { agentFeedback: feedback, agentFeedbackAt: new Date() },
    select: { agentFeedback: true, agentFeedbackAt: true },
  });

  // Takım liderine bildir
  if (evaluation.agent?.teamId) {
    const team = await prisma.team.findUnique({
      where: { id: evaluation.agent.teamId },
      select: { leaderId: true },
    });
    if (team?.leaderId) {
      await prisma.notification.createMany({
        data: [{
          userId: team.leaderId,
          type: "AGENT_FEEDBACK",
          message: `${evaluation.agent.name} değerlendirmeye kendi geri bildirimini yazdı.`,
          referenceId: id,
        }],
        skipDuplicates: true,
      });
    }
  }

  return NextResponse.json(updated);
}
