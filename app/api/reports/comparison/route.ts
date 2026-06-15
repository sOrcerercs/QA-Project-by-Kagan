import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { resolveScopedAgentIds, REPORTABLE_ROLES } from "@/app/lib/reportScope";
import { aggregateReport, type ReportData } from "@/app/lib/reportAggregation";

interface PeriodBucket { label: string; start: string; end: string; data: ReportData }

// First/last instant of a calendar month offset back from `ref` by `monthsAgo`.
function monthBucket(ref: Date, monthsAgo: number, lang: "tr" | "en"): { start: Date; end: Date; label: string } {
  const d = new Date(ref.getFullYear(), ref.getMonth() - monthsAgo, 1);
  const start = new Date(d.getFullYear(), d.getMonth(), 1, 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
  const label = start.toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", { month: "long", year: "numeric" });
  return { start, end, label };
}

async function buildBucket(start: Date, end: Date, label: string, scopedAgentIds: string[] | null): Promise<PeriodBucket> {
  const evaluations = await prisma.evaluation.findMany({
    where: {
      callDate: { gte: start, lte: end },
      ...(scopedAgentIds && { agentId: { in: scopedAgentIds } }),
      agent: { role: { in: [...REPORTABLE_ROLES] } },
    },
    include: { agent: { select: { id: true, name: true, email: true, teamId: true, team: { select: { name: true } }, role: true, manager: { select: { name: true } } } } },
    orderBy: { callDate: "asc" },
  });
  const allAgents = await prisma.user.findMany({
    where: { role: { in: [...REPORTABLE_ROLES] } },
    select: { id: true, name: true, teamId: true, team: { select: { name: true } } },
  });
  const visibleAgents = scopedAgentIds ? allAgents.filter(a => scopedAgentIds.includes(a.id)) : allAgents;
  const promptRows = await prisma.prompt.findMany({ select: { id: true, name: true } });
  const promptNameById = new Map(promptRows.map(p => [p.id, p.name]));
  const data = aggregateReport({
    evaluations: evaluations as any,
    visibleAgents: visibleAgents.map(a => ({ ...a, role: "AGENT" as const, manager: null })) as any,
    promptNameById,
  });
  return { label, start: start.toISOString(), end: end.toISOString(), data };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const sp = req.nextUrl.searchParams;
  const mode = sp.get("mode") === "trend" ? "trend" : "delta";
  const lang = sp.get("lang") === "en" ? "en" : "tr";

  const requestedIds = (sp.get("agentIds") ?? "").split(",").map(s => s.trim()).filter(Boolean);
  const { scopedAgentIds, error } = await resolveScopedAgentIds(user, requestedIds);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const periods: PeriodBucket[] = [];

  if (mode === "trend") {
    const n = sp.get("months") === "6" ? 6 : 3;
    const now = new Date();
    for (let i = n - 1; i >= 0; i--) {
      const { start, end, label } = monthBucket(now, i, lang);
      periods.push(await buildBucket(start, end, label, scopedAgentIds));
    }
  } else {
    let curStart: Date, curEnd: Date, curLabel: string;
    const monthParam = sp.get("month"); // YYYY-MM
    if (monthParam) {
      const [y, m] = monthParam.split("-").map(Number);
      curStart = new Date(y, m - 1, 1, 0, 0, 0);
      curEnd = new Date(y, m, 0, 23, 59, 59);
      curLabel = curStart.toLocaleDateString(lang === "en" ? "en-GB" : "tr-TR", { month: "long", year: "numeric" });
    } else {
      const startParam = sp.get("start"); const endParam = sp.get("end");
      curEnd = endParam ? new Date(endParam + "T23:59:59") : new Date();
      curStart = startParam ? new Date(startParam + "T00:00:00") : new Date(curEnd.getTime() - 30 * 86400000);
      curStart.setHours(0, 0, 0, 0);
      curLabel = lang === "en" ? "Current period" : "Bu dönem";
    }
    const durationMs = curEnd.getTime() - curStart.getTime();
    // 1ms before the current period starts — no gap/overlap. (curStart is
    // midnight, so subtracting a full day would leave a ~24h blind spot.)
    const prevEnd = new Date(curStart.getTime() - 1);
    const prevStart = new Date(prevEnd.getTime() - durationMs);
    const prevLabel = lang === "en" ? "Previous period" : "Önceki dönem";
    periods.push(await buildBucket(curStart, curEnd, curLabel, scopedAgentIds));
    periods.push(await buildBucket(prevStart, prevEnd, prevLabel, scopedAgentIds));
  }

  return NextResponse.json({ mode, periods });
}
