import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  const { id } = await params;
  const report = await prisma.qaReport.findUnique({
    where: { id },
    include: { rows: { orderBy: { id: "asc" } } },
  });
  if (!report) return NextResponse.json({ error: "Rapor bulunamadı." }, { status: 404 });
  return NextResponse.json({ report });
}
