import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { id } = await params;

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    include: {
      agent: {
        select: { id: true, name: true, email: true, team: { select: { name: true } } },
      },
    },
  });

  if (!evaluation) {
    return NextResponse.json({ error: "Değerlendirme bulunamadı." }, { status: 404 });
  }

  return NextResponse.json({ evaluation });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;

  const evaluation = await prisma.evaluation.findUnique({ where: { id }, select: { report: true } });
  if (!evaluation) {
    return NextResponse.json({ error: "Değerlendirme bulunamadı." }, { status: 404 });
  }

  const scoreMatch = evaluation.report.match(/(?:Genel Skor|Puan):[^0-9\n]*(\d+(?:[.,]\d+)?)/i);
  if (!scoreMatch) {
    return NextResponse.json({ error: "Rapor metninde skor bulunamadı." }, { status: 422 });
  }

  const score = Math.round(parseFloat(scoreMatch[1].replace(",", ".")));
  const updated = await prisma.evaluation.update({ where: { id }, data: { score } });

  return NextResponse.json({ score: updated.score });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
  }

  const { id } = await params;

  await prisma.evaluation.delete({ where: { id } });

  return NextResponse.json({ success: true });
}
