import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const admin = await getUserFromToken(req);
  if (!admin || !["ADMIN", "MANAGER"].includes(admin.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const params = req.nextUrl.searchParams;
  const userId = params.get("userId") || undefined;
  const limit = Math.min(parseInt(params.get("limit") || "200"), 500);

  const logs = await prisma.activityLog.findMany({
    where: userId ? { userId } : undefined,
    include: { user: { select: { id: true, name: true, email: true, role: true } } },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ logs });
}
