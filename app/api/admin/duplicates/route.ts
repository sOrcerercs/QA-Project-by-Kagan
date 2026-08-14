import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
// Ay→tarih aralığı ve agentIds ayrıştırması genel amaçlı saf yardımcılar;
// bugün okr.ts'te duruyorlar, kopyalamak yerine oradan alınıyor.
import { resolveRange, currentMonth, monthsBetween, parseAgentIds, FIRST_DATA_MONTH, ALL_MONTHS } from "@/app/lib/okr";
import { findDuplicateGroups, DEFAULT_WINDOW_MINUTES } from "@/app/lib/duplicateEvaluations";

/**
 * Mükerrer değerlendirmeler — SALT OKUNUR. Hiçbir silme/birleştirme yapmaz.
 *
 * Eşleştirme SQL self-join ile değil, saf findDuplicateGroups ile yapılıyor:
 * kural testlenebilir kalıyor ve transcript/report alanları hiç çekilmediği
 * için tüm tabloyu taramak ucuz (~3,4 bin satır, yalnızca küçük alanlar).
 */
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const nowMonth = currentMonth(new Date());
  const month = req.nextUrl.searchParams.get("month") || ALL_MONTHS;

  let agentIds: string[];
  let dateFilter: { callDate: { gte: Date; lte: Date } } | undefined;
  try {
    agentIds = parseAgentIds(req.nextUrl.searchParams.get("agentIds"));
    // Tüm zamanlar için tarih filtresi hiç uygulanmıyor: veri sağlığı taraması
    // ilk veri ayıyla sınırlanmamalı.
    if (month !== ALL_MONTHS) {
      const range = resolveRange(month, FIRST_DATA_MONTH, nowMonth);
      dateFilter = { callDate: { gte: range.start, lte: range.end } };
    }
  } catch {
    return NextResponse.json({ error: "Geçersiz filtre." }, { status: 400 });
  }

  try {
    const [rows, agents] = await Promise.all([
      prisma.evaluation.findMany({
        where: {
          ...(dateFilter ?? {}),
          ...(agentIds.length > 0 ? { agentId: { in: agentIds } } : {}),
        },
        // transcript/report BİLEREK yok — 10 KB'lık metinler taşınmasın.
        select: {
          id: true, agentId: true, customerName: true, callDate: true,
          callDuration: true, score: true, callType: true, source: true,
          coachingDone: true, agentRead: true,
          agent: { select: { name: true } },
        },
      }),
      prisma.user.findMany({
        where: { isActive: true },
        select: { id: true, name: true },
        orderBy: { name: "asc" },
      }),
    ]);

    const groups = findDuplicateGroups(rows, DEFAULT_WINDOW_MINUTES).map((g) => ({
      tier: g.tier,
      minutesApart: g.minutesApart,
      customerUnknown: g.customerUnknown,
      rows: g.rows.map((r) => ({
        id: r.id,
        callDate: r.callDate,
        customerName: r.customerName,
        agentName: r.agent.name,
        callDuration: r.callDuration,
        score: r.score,
        callType: r.callType,
        source: r.source,
        // Hangi kaydın üzerinde gerçek emek var: silme kararı verilecekse gerekir.
        coachingDone: r.coachingDone,
        agentRead: r.agentRead,
      })),
    }));

    return NextResponse.json({
      month,
      agentIds,
      windowMinutes: DEFAULT_WINDOW_MINUTES,
      availableMonths: [ALL_MONTHS, ...monthsBetween(FIRST_DATA_MONTH, nowMonth).reverse()],
      agents,
      totals: {
        groups: groups.length,
        exact: groups.filter((g) => g.tier === "KESIN").length,
        likely: groups.filter((g) => g.tier === "COK_OLASI").length,
        extraRows: groups.reduce((sum, g) => sum + g.rows.length - 1, 0),
      },
      groups,
    });
  } catch (e) {
    console.error("[GET /api/admin/duplicates]", e);
    return NextResponse.json({ error: "Mükerrer listesi yüklenemedi." }, { status: 500 });
  }
}
