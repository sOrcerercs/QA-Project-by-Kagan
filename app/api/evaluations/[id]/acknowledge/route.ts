import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { id } = await params;

  const evaluation = await prisma.evaluation.findUnique({ where: { id }, select: { agentId: true } });
  if (!evaluation) return NextResponse.json({ error: "Bulunamadı." }, { status: 404 });

  if (user.role === "AGENT" && evaluation.agentId !== user.id) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  if (!["AGENT", "ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const updated = await prisma.evaluation.update({
    where: { id },
    data: { agentRead: true, agentReadAt: new Date() },
    select: { agentRead: true, agentReadAt: true },
  });

  return NextResponse.json(updated);
}
