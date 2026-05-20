import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;
  const { isRead } = await req.json();

  const updated = await prisma.feedback.update({
    where: { id },
    data: { isRead: isRead ?? true },
  });

  return NextResponse.json({ feedback: updated });
}
