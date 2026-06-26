import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { parseQaWorkbook } from "@/app/lib/qaReportParse";
import { matchEvaluationForRow } from "@/app/lib/qaMatch";
import { canEditQa } from "@/app/lib/qaPermissions";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !canEditQa(user.email)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const form = await req.formData();
  const file = form.get("file") as File | null;
  const reportDateStr = (form.get("reportDate") as string) || "";
  if (!file) return NextResponse.json({ error: "Dosya gerekli." }, { status: 400 });

  const reportDate = reportDateStr ? new Date(reportDateStr + "T00:00:00") : new Date();
  reportDate.setHours(0, 0, 0, 0);

  let parsed;
  try {
    const buffer = Buffer.from(await file.arrayBuffer());
    parsed = parseQaWorkbook(buffer);
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Excel okunamadı." }, { status: 400 });
  }
  if (parsed.length === 0) return NextResponse.json({ error: "Geçerli satır bulunamadı." }, { status: 400 });

  // Candidate evaluations within +/- 3 days of the report date.
  const windowStart = new Date(reportDate.getTime() - 3 * 86400000);
  const windowEnd = new Date(reportDate.getTime() + 4 * 86400000 - 1);
  const evals = await prisma.evaluation.findMany({
    where: { callDate: { gte: windowStart, lte: windowEnd } },
    select: { id: true, customerName: true, agent: { select: { name: true } } },
  });
  const candidates = evals.map(e => ({ id: e.id, customerName: e.customerName, agentName: e.agent?.name ?? null }));

  // Preserve QA Notes + manual overrides from an existing report for the same date (keyed by crmId).
  const existing = await prisma.qaReport.findFirst({ where: { reportDate }, include: { rows: true } });
  const preserved = new Map<string, { qaNotes: string | null; manualOverride: boolean; callRecord: boolean; matchedEvaluationId: string | null }>();
  if (existing) {
    for (const r of existing.rows) {
      if (r.crmId) preserved.set(r.crmId, { qaNotes: r.qaNotes, manualOverride: r.manualOverride, callRecord: r.callRecord, matchedEvaluationId: r.matchedEvaluationId });
    }
  }

  const rowsData = parsed.map(p => {
    const autoMatchId = matchEvaluationForRow(p, candidates);
    const prev = p.crmId ? preserved.get(p.crmId) : undefined;
    // A manually-corrected row (tick toggled or evaluation linked) wins over
    // auto-matching on re-upload, so manual links/ticks survive new Excel uploads.
    const manual = prev?.manualOverride ?? false;
    return {
      salesOwner: p.salesOwner, status: p.status, bookingDate: p.bookingDate, crmId: p.crmId,
      customerName: p.customerName, dealStage: p.dealStage, contactType: p.contactType,
      contactMethod: p.contactMethod, recentNote: p.recentNote, country: p.country, timeFrame: p.timeFrame,
      matchedEvaluationId: manual ? prev!.matchedEvaluationId : autoMatchId,
      callRecord: manual ? prev!.callRecord : !!autoMatchId,
      manualOverride: manual,
      qaNotes: prev?.qaNotes ?? p.qaNotes,
    };
  });

  const report = await prisma.$transaction(async (tx) => {
    if (existing) await tx.qaReport.delete({ where: { id: existing.id } });
    return tx.qaReport.create({
      data: {
        reportDate,
        uploadedById: user.id,
        uploadedByName: user.name ?? user.email ?? "—",
        rows: { create: rowsData },
      },
      select: { id: true, _count: { select: { rows: true } } },
    });
  });

  return NextResponse.json({ ok: true, reportId: report.id, rowCount: report._count.rows });
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  const reports = await prisma.qaReport.findMany({
    orderBy: { reportDate: "desc" },
    take: 90,
    select: { id: true, reportDate: true, uploadedByName: true, createdAt: true, _count: { select: { rows: true } } },
  });
  return NextResponse.json({ reports });
}
