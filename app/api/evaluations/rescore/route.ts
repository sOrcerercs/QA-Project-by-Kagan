import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { pendingWhere, DEEP_SCORE_FROM, DEEP_SCORE_MAX_ATTEMPTS } from "@/app/lib/deepScore";

/** "2026-09-03" → o Türkiye gününün başlangıcı. Repo genelinde TR günü kullanılır. */
export function parseTrDay(value: string | null | undefined): Date | undefined {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return undefined;
  const d = new Date(`${value}T00:00:00.000+03:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const from = parseTrDay(searchParams.get("from"));
  const toDay = parseTrDay(searchParams.get("to"));
  // --to dahil: verilen günün sonuna kadar.
  const to = toDay ? new Date(toDay.getTime() + 24 * 60 * 60 * 1000) : undefined;
  const range = { from, to };

  const [pending, oldest, exhausted] = await Promise.all([
    prisma.evaluation.count({ where: pendingWhere(range) }),
    prisma.evaluation.findFirst({
      where: pendingWhere(range),
      orderBy: { callDate: "asc" },
      select: { callDate: true },
    }),
    // Deneme hakkı dolup kuyruktan düşenler: panelde ayrıca gösterilir ki
    // "bekleyen 0" derken aslında takılmış kayıt olduğu fark edilsin.
    prisma.evaluation.count({
      where: {
        deepScoredAt: null,
        deepScoreAttempts: { gte: DEEP_SCORE_MAX_ATTEMPTS },
        callDate: { gte: from && from > DEEP_SCORE_FROM ? from : DEEP_SCORE_FROM, ...(to ? { lt: to } : {}) },
      },
    }),
  ]);

  return NextResponse.json({
    pending,
    exhausted,
    oldest: oldest?.callDate.toISOString() ?? null,
    scopeFrom: DEEP_SCORE_FROM.toISOString(),
  });
}
