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
  if (!["4w", "3m", "6m", "all"].includes(rawRange)) {
    return NextResponse.json({ error: "Geçersiz range." }, { status: 400 });
  }
  const range = rawRange as Range;

  const rangeStart = getRangeStart(range);
  const allEvals = await prisma.evaluation.findMany({
    where: {
      agentId,
      ...(rangeStart && { createdAt: { gte: rangeStart } }),
    },
    select: { createdAt: true, sectionScores: true },
    orderBy: { createdAt: "asc" },
  });

  const evaluations = allEvals.filter((e) => e.sectionScores !== null);

  const weekMap = new Map<
    string,
    { weekStart: Date; A: number[]; B: number[]; C: number[] }
  >();

  for (const e of evaluations) {
    const key = getISOWeekKey(e.createdAt);
    const raw = e.sectionScores as Record<string, unknown>;
    const numA = typeof raw?.A === "number" ? raw.A : 0;
    const numB = typeof raw?.B === "number" ? raw.B : 0;
    const numC = typeof raw?.C === "number" ? raw.C : 0;
    if (!weekMap.has(key)) {
      weekMap.set(key, { weekStart: getWeekStart(e.createdAt), A: [], B: [], C: [] });
    }
    const bucket = weekMap.get(key)!;
    bucket.A.push(numA);
    bucket.B.push(numB);
    bucket.C.push(numC);
  }

  const weeks = Array.from(weekMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v], idx) => ({
      week: `H${idx + 1}`,
      date: v.weekStart.toLocaleDateString("tr-TR", { day: "numeric", month: "short" }),
      A: avg(v.A),
      B: avg(v.B),
      C: avg(v.C),
      callCount: v.A.length,
    }));

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
  });
}
