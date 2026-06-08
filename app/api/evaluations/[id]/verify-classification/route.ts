// app/api/evaluations/[id]/verify-classification/route.ts
// Marks an evaluation's stored call type as confirmed-correct ("Done" in the
// Suspicious Classifications scan), so it is excluded from future scans.
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 401 });
  if (user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz erişim." }, { status: 403 });
  }

  const { id } = await params;

  try {
    await prisma.evaluation.update({
      where: { id },
      data: { classificationVerified: true },
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Değerlendirme bulunamadı." }, { status: 404 });
  }
}
