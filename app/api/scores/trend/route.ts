import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

type Range = "4w" | "3m" | "6m" | "all";

const SECTION_LABELS: Record<"A" | "B" | "C", string> = {
  A: "Giriş & Profilleme",
  B: "Çözüm & Otorite",
  C: "Kapanış & Köprü",
};

function getRangeStart(range: Range): Date | null {
  const now = new Date();
  if (range === "4w") { const d = new Date(now); d.setDate(d.getDate() - 28); return d; }
  if (range === "3m") { const d = new Date(now); d.setDate(d.getDate() - 90); return d; }
  if (range === "6m") { const d = new Date(now); d.setDate(d.getDate() - 180); return d; }
  return null;
}

function getISOWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const week1 = new Date(d.getFullYear(), 0, 4);
  const weekNum = 1 + Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return `${d.getFullYear()}-W${String(weekNum).padStart(2, "0")}`;
}

function getWeekStart(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  d.setHours(0, 0, 0, 0);
  return d;
}

function getWeekEnd(weekStart: Date): Date {
  const d = new Date(weekStart);
  d.setDate(d.getDate() + 6);
  return d;
}

const avg = (arr: number[]) =>
  arr.length === 0 ? 0 : Math.round(arr.reduce((s, v) => s + v, 0) / arr.length);

type Section = "A" | "B" | "C";
type DropIndicator = {
  section: Section;
  label: string;
  from: number;
  to: number;
  delta: number;
} | null;

function calcDrop(
  from: Record<Section, number>,
  to: Record<Section, number>
): DropIndicator {
  const deltas = (["A", "B", "C"] as Section[]).map((k) => ({
    section: k,
    delta: to[k] - from[k],
  }));
  const worst = deltas.sort((a, b) => a.delta - b.delta)[0];
  if (worst.delta >= 0) return null;
  return {
    section: worst.section,
    label: SECTION_LABELS[worst.section],
    from: from[worst.section],
    to: to[worst.section],
    delta: worst.delta,
  };
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get("agentId") || user.id;
  const rawRange = req.nextUrl.searchParams.get("range") || "4w";

  if (user.role === "AGENT" && agentId !== user.id) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  if (user.role === "TEAM_LEADER" && agentId !== user.id) {
    const teamMember = await prisma.user.findFirst({
      where: { id: agentId, team: { leaderId: user.id } },
    });
    if (!teamMember) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  if (!["4w", "3m", "6m", "all"].includes(rawRange)) {
    return NextResponse.json({ error: "Geçersiz range." }, { status: 400 });
  }
  const range = rawRange as Range;

  const rangeStart = getRangeStart(range);
  const allEvals = await prisma.evaluation.findMany({
    where: {
      agentId,
      ...(rangeStart && { callDate: { gte: rangeStart } }),
    },
    select: { callDate: true, sectionScores: true, weakCriteria: true },
    orderBy: { callDate: "asc" },
  });

  const evaluations = allEvals.filter((e) => e.sectionScores !== null);

  type CriteriaBucket = { label: string; count: number; scoreSum: number };
  const weekMap = new Map<
    string,
    { weekStart: Date; A: number[]; B: number[]; C: number[]; criteriaMap: Map<string, CriteriaBucket> }
  >();

  for (const e of evaluations) {
    const key = getISOWeekKey(e.callDate);
    const raw = e.sectionScores as Record<string, unknown>;
    const numA = typeof raw?.A === "number" ? raw.A : 0;
    const numB = typeof raw?.B === "number" ? raw.B : 0;
    const numC = typeof raw?.C === "number" ? raw.C : 0;
    if (!weekMap.has(key)) {
      weekMap.set(key, { weekStart: getWeekStart(e.callDate), A: [], B: [], C: [], criteriaMap: new Map() });
    }
    const bucket = weekMap.get(key)!;
    bucket.A.push(numA);
    bucket.B.push(numB);
    bucket.C.push(numC);

    const wc = e.weakCriteria as Array<{ id: string; label: string; score: number }> | null;
    if (Array.isArray(wc)) {
      for (const c of wc) {
        if (!c.id || !c.label) continue;
        const existing = bucket.criteriaMap.get(c.id);
        if (existing) {
          existing.count++;
          existing.scoreSum += c.score ?? 0;
        } else {
          bucket.criteriaMap.set(c.id, { label: c.label, count: 1, scoreSum: c.score ?? 0 });
        }
      }
    }
  }

  const locale = "tr-TR";
  const dateOpts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  const sortedEntries = Array.from(weekMap.entries()).sort(([a], [b]) => a.localeCompare(b));

  const weeks = sortedEntries.map(([, v], idx) => ({
    week: `H${idx + 1}`,
    date: v.weekStart.toLocaleDateString(locale, dateOpts),
    A: avg(v.A),
    B: avg(v.B),
    C: avg(v.C),
    callCount: v.A.length,
  }));

  const weakCriteriaTrend = sortedEntries.map(([, v], idx) => {
    const weekEnd = getWeekEnd(v.weekStart);
    const dateRange = `${v.weekStart.toLocaleDateString(locale, dateOpts)}–${weekEnd.toLocaleDateString(locale, dateOpts)}`;
    const topCriteria = Array.from(v.criteriaMap.entries())
      .map(([id, c]) => ({
        id,
        label: c.label,
        count: c.count,
        avgScore: c.count > 0 ? Math.round(c.scoreSum / c.count) : 0,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);
    return { week: `H${idx + 1}`, date: dateRange, topCriteria };
  });

  const overallMap = new Map<string, { label: string; totalCount: number }>();
  for (const [, v] of sortedEntries) {
    for (const [id, c] of v.criteriaMap.entries()) {
      const existing = overallMap.get(id);
      if (existing) {
        existing.totalCount += c.count;
      } else {
        overallMap.set(id, { label: c.label, totalCount: c.count });
      }
    }
  }
  const topCriteriaOverall = Array.from(overallMap.entries())
    .map(([id, c]) => ({ id, label: c.label, totalCount: c.totalCount }))
    .sort((a, b) => b.totalCount - a.totalCount)
    .slice(0, 8);

  const hasEnoughData = weeks.length >= 2;

  let periodDrop: DropIndicator = null;
  let lastWeekDrop: DropIndicator = null;

  if (hasEnoughData) {
    const first = weeks[0];
    const last = weeks[weeks.length - 1];
    periodDrop = calcDrop(
      { A: first.A, B: first.B, C: first.C },
      { A: last.A, B: last.B, C: last.C }
    );
    const prev = weeks[weeks.length - 2];
    lastWeekDrop = calcDrop(
      { A: prev.A, B: prev.B, C: prev.C },
      { A: last.A, B: last.B, C: last.C }
    );
  }

  return NextResponse.json({
    weeks,
    trendIndicators: { periodDrop, lastWeekDrop },
    hasEnoughData,
    weakCriteriaTrend,
    topCriteriaOverall,
  });
}
