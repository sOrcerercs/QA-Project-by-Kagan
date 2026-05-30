import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

/** Atanmamış çağrıları listele (Admin/Manager) */
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const items = await prisma.evaluation.findMany({
    where: { unassigned: true },
    select: {
      id: true,
      customerName: true,
      callDuration: true,
      score: true,
      callType: true,
      callDate: true,
      externalAgentName: true,
      externalCallId: true,
      recordingUrl: true,
      source: true,
      transcript: true,
    },
    orderBy: { callDate: "desc" },
  });

  return NextResponse.json({ items });
}
