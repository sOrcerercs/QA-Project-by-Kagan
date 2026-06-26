import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { canEditQa } from "@/app/lib/qaPermissions";
import { parseEvaluationId } from "@/app/lib/evaluationLink";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ rowId: string }> }) {
  const user = await getUserFromToken(req);
  if (!user || !canEditQa(user.email)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  const { rowId } = await params;
  const body = await req.json().catch(() => ({}));
  const data: { qaNotes?: string; callRecord?: boolean; manualOverride?: boolean; matchedEvaluationId?: string } = {};
  if (typeof body.qaNotes === "string") data.qaNotes = body.qaNotes;
  if (typeof body.callRecord === "boolean") { data.callRecord = body.callRecord; data.manualOverride = true; }
  if (typeof body.evaluationLink === "string") {
    const id = parseEvaluationId(body.evaluationLink);
    if (!id) return NextResponse.json({ error: "Geçersiz değerlendirme linki." }, { status: 400 });
    const ev = await prisma.evaluation.findUnique({ where: { id }, select: { id: true } });
    if (!ev) return NextResponse.json({ error: "Değerlendirme bulunamadı." }, { status: 404 });
    // Linking an evaluation implies a call record exists; tick it and lock it from re-upload.
    data.matchedEvaluationId = id;
    data.callRecord = true;
    data.manualOverride = true;
  }
  if (Object.keys(data).length === 0) return NextResponse.json({ error: "Güncellenecek alan yok." }, { status: 400 });
  const row = await prisma.qaReportRow.update({ where: { id: rowId }, data });
  return NextResponse.json({ ok: true, row });
}
