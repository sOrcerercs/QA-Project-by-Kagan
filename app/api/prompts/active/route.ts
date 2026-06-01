import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

// Aktif promptları listele — salt-okunur, tüm giriş yapmış roller (AGENT dahil).
// Yalnızca isActive=true promptları döndürür; pasif/eski sürümler sızmaz.
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const prompts = await prisma.prompt.findMany({
    where: { isActive: true },
    select: {
      id: true,
      name: true,
      callType: true,
      content: true,
      version: true,
      updatedAt: true,
    },
    orderBy: [{ callType: "asc" }],
  });

  return NextResponse.json({ prompts });
}
