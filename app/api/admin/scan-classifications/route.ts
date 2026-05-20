// app/api/admin/scan-classifications/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { keywordDetectCallType } from "@/app/lib/callTypeDetector";

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const evaluations = await prisma.evaluation.findMany({
    where: { callType: { in: ["FIRST_CALL", "SECOND_CALL"] } },
    select: {
      id: true,
      callType: true,
      customerName: true,
      transcript: true,
      agent: { select: { name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const suspicious = evaluations
    .filter((ev) => ev.transcript && ev.transcript.length >= 50)
    .map((ev) => {
      const detected = keywordDetectCallType(ev.transcript!);
      // Only include if keyword scan is confident (non-null) AND disagrees with stored type
      if (detected === null || detected === ev.callType) return null;
      return {
        id: ev.id,
        agentName: ev.agent?.name ?? "Belirtilmedi",
        customerName: ev.customerName,
        storedCallType: ev.callType,
        suggestedCallType: detected,
      };
    })
    .filter(Boolean);

  return NextResponse.json({ items: suspicious, total: evaluations.length });
}
