import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

const TAKE = 25;

async function getSourceData(source: "KRIKO" | "FIREFLIES") {
  const [items, total, dupes] = await Promise.all([
    prisma.evaluation.findMany({
      where: { source },
      orderBy: { createdAt: "desc" },
      take: TAKE,
      select: {
        id: true,
        externalCallId: true,
        externalAgentName: true,
        customerName: true,
        callDate: true,
        callDuration: true,
        score: true,
        callType: true,
        unassigned: true,
        createdAt: true,
        agent: { select: { name: true } },
      },
    }),
    prisma.evaluation.count({ where: { source } }),
    prisma.evaluation.groupBy({
      by: ["externalCallId"],
      where: { source, externalCallId: { not: null } },
      _count: { externalCallId: true },
      having: { externalCallId: { _count: { gt: 1 } } },
    }),
  ]);

  return {
    items: items.map(e => ({
      id: e.id,
      externalCallId: e.externalCallId,
      agentName: e.agent?.name ?? e.externalAgentName ?? "Belirtilmedi",
      externalAgentName: e.externalAgentName,
      customerName: e.customerName,
      callDate: e.callDate,
      callDuration: e.callDuration,
      score: e.score,
      callType: e.callType,
      unassigned: e.unassigned,
      importedAt: e.createdAt,
    })),
    total,
    duplicateCount: dupes.length,
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const [kriko, fireflies] = await Promise.all([
    getSourceData("KRIKO"),
    getSourceData("FIREFLIES"),
  ]);

  return NextResponse.json({ kriko, fireflies });
}
