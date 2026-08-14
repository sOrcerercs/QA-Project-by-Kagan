import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { canViewOkr } from "@/app/lib/okrPermissions";
import {
  monthRange, currentMonth, previousMonth, monthsBetween,
  averageScore, upsellRate, agentAverages, bottomSellersValue,
  type AgentAverage,
} from "@/app/lib/okr";
import type { UpsellStatus } from "@/app/lib/upsellClassify";

const FIRST_DATA_MONTH = "2026-05"; // sistemdeki en eski değerlendirme: 2026-05-18

// app/api/calls/sync-fireflies/route.ts içindeki UNASSIGNED_EMAIL ile aynı olmalı.
const UNASSIGNED_AGENT_EMAIL = "unassigned@estenove.local";

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  if (!canViewOkr(user.email)) return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });

  const nowMonth = currentMonth(new Date());
  const month = req.nextUrl.searchParams.get("month") || nowMonth;

  let range: { start: Date; end: Date };
  try {
    range = monthRange(month);
  } catch {
    return NextResponse.json({ error: "Geçersiz ay." }, { status: 400 });
  }

  try {
    const dateFilter = { callDate: { gte: range.start, lte: range.end } };

    const [evaluations, upsellRows, pendingCount, users, savedRows] = await Promise.all([
      prisma.evaluation.findMany({
        where: dateFilter,
        select: { agentId: true, score: true },
      }),
      prisma.evaluationUpsell.findMany({
        where: { evaluation: { ...dateFilter, callType: "SECOND_CALL" } },
        // score, kusursuz puan kuralı için gerekli (bkz. upsellRate)
        select: { stemCell: true, premium: true, evaluation: { select: { score: true } } },
      }),
      prisma.evaluation.count({
        where: { ...dateFilter, callType: "SECOND_CALL", evaluationUpsell: { is: null } },
      }),
      prisma.user.findMany({ select: { id: true, name: true, role: true, isActive: true, email: true } }),
      prisma.okrBottomSeller.findMany({ where: { month }, select: { userId: true } }),
    ]);

    const names = new Map(users.map((u) => [u.id, u.name]));

    // Alt-5 seçicisi yalnızca gerçek, aktif danışmanları göstermeli. Fireflies
    // senkronizasyonu, konuşmacısı eşleşmeyen çağrılar için "Atanmamış" adlı
    // AGENT rolünde kalıcı bir yer tutucu hesap açıyor (bkz.
    // app/api/calls/sync-fireflies/route.ts) — rolü gerçekten AGENT olduğu için
    // rol filtresi tek başına elemiyor, e-posta ile ayrıca dışlanıyor.
    // isActive filtresi app/api/users/route.ts'in konvansiyonunu izler.
    const eligible = new Set(
      users
        .filter((u) => u.role === "AGENT" && u.isActive && u.email !== UNASSIGNED_AGENT_EMAIL)
        .map((u) => u.id)
    );

    const allAverages = agentAverages(evaluations, names);
    // agentById bilerek FİLTRESİZ listeden kurulur: geçmiş bir ayda kaydedilmiş
    // seçim, kişi sonradan pasifleştirilse bile o ayki skorunu göstermeye devam
    // etmeli — aksi halde geçmiş OKR değeri sessizce değişir.
    const agentById = new Map(allAverages.map((a) => [a.id, a]));
    const agents = allAverages.filter((a) => eligible.has(a.id));

    // Kaydedilmiş seçim yoksa önceki aydan öner (kaydedilmez, sadece önseçili gelir).
    let selectedIds = savedRows.map((r) => r.userId);
    let inheritedFrom: string | null = null;
    if (selectedIds.length === 0) {
      const prev = previousMonth(month);
      const prevRows = await prisma.okrBottomSeller.findMany({
        where: { month: prev }, select: { userId: true },
      });
      if (prevRows.length > 0) {
        selectedIds = prevRows.map((r) => r.userId);
        inheritedFrom = prev;
      }
    }

    const selected: AgentAverage[] = selectedIds.map(
      (id) => agentById.get(id) ?? { id, name: names.get(id) ?? id, avgScore: null, callCount: 0 }
    );

    const typedUpsell = upsellRows.map(r => ({
      stemCell: r.stemCell as UpsellStatus,
      premium: r.premium as UpsellStatus,
      score: r.evaluation.score,
    }));

    return NextResponse.json({
      month,
      availableMonths: monthsBetween(FIRST_DATA_MONTH, nowMonth).reverse(),
      quality: { value: averageScore(evaluations), count: evaluations.length },
      stemCell: upsellRate(typedUpsell, "stemCell"),
      premium: upsellRate(typedUpsell, "premium"),
      bottomSellers: { value: bottomSellersValue(selected), inheritedFrom, selected },
      pendingCount,
      agents,
    });
  } catch (e) {
    console.error("[GET /api/okr]", e);
    return NextResponse.json({ error: "OKR verileri yüklenemedi." }, { status: 500 });
  }
}
