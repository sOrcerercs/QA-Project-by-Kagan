import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const tokenUser = await getUserFromToken(req);
  if (!tokenUser) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const teams = await prisma.team.findMany({
    include: { leader: { select: { id: true, name: true } } },
    orderBy: { name: "asc" },
  });

  return NextResponse.json({ teams });
}
