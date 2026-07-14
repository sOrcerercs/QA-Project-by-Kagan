import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { canEditQa } from "@/app/lib/qaPermissions";
import { validateIssueInput } from "@/app/lib/knownIssues";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromToken(req);
  if (!user || !canEditQa(user.email)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const result = validateIssueInput(body);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });

  try {
    const issue = await prisma.knownIssue.update({ where: { id }, data: result.value });
    return NextResponse.json({ issue });
  } catch (e: any) {
    console.error("[PATCH /api/known-issues/:id]", e);
    if (e?.code === "P2025") return NextResponse.json({ error: "Sorun bulunamadı." }, { status: 404 });
    return NextResponse.json({ error: "Güncellenemedi." }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const user = await getUserFromToken(req);
  if (!user || !canEditQa(user.email)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  const { id } = await ctx.params;
  try {
    await prisma.knownIssue.delete({ where: { id } });
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    console.error("[DELETE /api/known-issues/:id]", e);
    if (e?.code === "P2025") return NextResponse.json({ error: "Sorun bulunamadı." }, { status: 404 });
    return NextResponse.json({ error: "Silinemedi." }, { status: 500 });
  }
}
