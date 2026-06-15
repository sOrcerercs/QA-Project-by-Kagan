import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ rowId: string }> }) {
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  const { rowId } = await params;
  const body = await req.json().catch(() => ({}));
  const data: { qaNotes?: string; callRecord?: boolean; manualOverride?: boolean } = {};
  if (typeof body.qaNotes === "string") data.qaNotes = body.qaNotes;
  if (typeof body.callRecord === "boolean") { data.callRecord = body.callRecord; data.manualOverride = true; }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
  const row = await prisma.qaReportRow.update({ where: { id: rowId }, data });
  return NextResponse.json({ ok: true, row });
}
