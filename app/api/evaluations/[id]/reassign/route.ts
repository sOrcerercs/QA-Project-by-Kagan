import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

/**
 * Bir Evaluation'ı doğru danışmana ata.
 * Body: { agentId: string }
 */
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { agentId } = await req.json();
  if (!agentId) return NextResponse.json({ error: "agentId zorunlu." }, { status: 400 });

  const target = await prisma.user.findUnique({ where: { id: agentId } });
  if (!target) return NextResponse.json({ error: "Hedef danışman bulunamadı." }, { status: 404 });
  if (target.email === "unassigned@estenove.local") {
    return NextResponse.json({ error: "Atanmamış kullanıcıya yeniden atama yapılamaz." }, { status: 400 });
  }

  const updated = await prisma.evaluation.update({
    where: { id },
    data: { agentId, unassigned: false },
    select: { id: true, customerName: true, score: true },
  });

  const agent = await prisma.user.findUnique({ where: { id: agentId }, select: { teamId: true } });
  const notifyIds: string[] = [agentId];
  if (agent?.teamId) {
    const team = await prisma.team.findUnique({ where: { id: agent.teamId }, select: { leaderId: true } });
    if (team?.leaderId) notifyIds.push(team.leaderId);
  }
  await prisma.notification.createMany({
    data: notifyIds.map(uid => ({
      userId: uid,
      type: "EVALUATION",
      message: `${updated.customerName} için değerlendirme tamamlandı. Skor: %${updated.score}`,
      referenceId: updated.id,
    })),
    skipDuplicates: true,
  });

  return NextResponse.json({ evaluation: updated });
}
