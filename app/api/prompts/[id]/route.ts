import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

// Prompt güncelle
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;
  const { name, content, version, isActive } = await req.json();

  // Aktif yapılıyorsa aynı callType'taki diğerlerini pasif yap
  if (isActive) {
    const existing = await prisma.prompt.findUnique({ where: { id } });
    if (existing) {
      await prisma.prompt.updateMany({
        where: { callType: existing.callType, isActive: true, id: { not: id } },
        data: { isActive: false },
      });
    }
  }

  const prompt = await prisma.prompt.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(content !== undefined && { content }),
      ...(version !== undefined && { version }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json({ prompt });
}

// Prompt sil (soft delete)
export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await params;

  const prompt = await prisma.prompt.update({
    where: { id },
    data: { isActive: false },
  });

  return NextResponse.json({ prompt });
}
