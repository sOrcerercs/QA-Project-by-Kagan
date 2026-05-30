import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const feedbacks = await prisma.feedback.findMany({
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ feedbacks });
}

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (["ADMIN"].includes(user.role)) {
    return NextResponse.json({ error: "Admin geri bildirim gönderemez." }, { status: 403 });
  }

  const { category, comment } = await req.json();
  if (!category || !comment?.trim()) {
    return NextResponse.json({ error: "Kategori ve yorum zorunludur." }, { status: 400 });
  }

  const feedback = await prisma.feedback.create({
    data: { userId: user.id, category, comment: comment.trim() },
  });

  // Notify all admins/managers
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });

  await prisma.notification.createMany({
    data: admins.map((a) => ({
      userId: a.id,
      type: "FEEDBACK",
      message: `${user.name} yeni bir geri bildirim gönderdi.`,
      referenceId: feedback.id,
    })),
  });

  return NextResponse.json({ feedback });
}
