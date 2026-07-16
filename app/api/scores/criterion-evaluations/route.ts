import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { extractCriterionOccurrences, EvaluationForCriterion } from "@/app/lib/criterionOccurrences";

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get("agentId") || user.id;
  const criterionId = req.nextUrl.searchParams.get("criterionId");
  if (!criterionId) {
    return NextResponse.json({ error: "criterionId gerekli." }, { status: 400 });
  }

  const startDate = req.nextUrl.searchParams.get("startDate");
  const endDate = req.nextUrl.searchParams.get("endDate");

  const isValidDate = (s: string) => !isNaN(Date.parse(s));
  if (startDate && !isValidDate(startDate)) {
    return NextResponse.json({ error: "Geçersiz startDate." }, { status: 400 });
  }
  if (endDate && !isValidDate(endDate)) {
    return NextResponse.json({ error: "Geçersiz endDate." }, { status: 400 });
  }

  const dateFilter = startDate || endDate ? {
    callDate: {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate + "T23:59:59.999Z") }),
    },
  } : {};

  // Rol kontrolü: AGENT sadece kendini görebilir
  if (user.role === "AGENT" && agentId !== user.id) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  // TEAM_LEADER sadece kendi takımını görebilir
  if (user.role === "TEAM_LEADER" && agentId !== user.id) {
    const leadingTeam = await prisma.team.findUnique({
      where: { leaderId: user.id },
      select: { id: true },
    });
    const targetUser = await prisma.user.findUnique({ where: { id: agentId }, select: { teamId: true } });
    if (!leadingTeam || targetUser?.teamId !== leadingTeam.id) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
    }
  }

  const evaluations = await prisma.evaluation.findMany({
    where: { agentId, ...dateFilter },
    orderBy: { callDate: "desc" },
    select: { id: true, customerName: true, callDate: true, score: true, weakCriteria: true },
  });

  const occurrences = extractCriterionOccurrences(evaluations as EvaluationForCriterion[], criterionId);
  return NextResponse.json({ occurrences });
}
