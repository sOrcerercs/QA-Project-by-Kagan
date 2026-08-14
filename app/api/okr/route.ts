import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { canViewOkr } from "@/app/lib/okrPermissions";
import { REPORTABLE_ROLES } from "@/app/lib/reportScope";
import {
  resolveRange, currentMonth, previousMonth, monthsBetween,
  averageScore, upsellRate, agentAverages, bottomSellersValue,
  groupByTrMonth, averageOfValues, parseCallType, parseAgentIds, filterEvaluations,
  ALL_MONTHS,
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
  const isAll = month === ALL_MONTHS;

  let range: { start: Date; end: Date };
  let callType: ReturnType<typeof parseCallType>;
  let agentIds: string[];
  try {
    range = resolveRange(month, FIRST_DATA_MONTH, nowMonth);
    callType = parseCallType(req.nextUrl.searchParams.get("callType"));
    agentIds = parseAgentIds(req.nextUrl.searchParams.get("agentIds"));
  } catch {
    return NextResponse.json({ error: "Geçersiz filtre." }, { status: 400 });
  }

  try {
    const dateFilter = { callDate: { gte: range.start, lte: range.end } };
    // Raporlarım sayfası (app/api/reports/auto/route.ts) yalnızca REPORTABLE_ROLES'u
    // sayıyor; OKR de aynı kümeyi kullanmalı, yoksa MANAGER hesaplarının
    // değerlendirmeleri iki ekran arasında fark yaratıyor.
    const roleFilter = { agent: { role: { in: [...REPORTABLE_ROLES] } } };
    // Danışman filtresi kalite/Stem Cell/Premium'u etkiler; alt-5 kartına
    // uygulanmaz (kendi elle seçimi var), o yüzden değerlendirmeler filtresiz
    // çekilip süzme bellekte yapılıyor.
    const agentFilter = agentIds.length > 0 ? { agentId: { in: agentIds } } : {};

    const [evaluations, upsellRows, pendingCount, users, savedRows] = await Promise.all([
      prisma.evaluation.findMany({
        where: { ...dateFilter, ...roleFilter },
        // callDate, ALL seçildiğinde alt-5'i aya bölmek için gerekli.
        select: { agentId: true, score: true, callType: true, callDate: true },
      }),
      prisma.evaluationUpsell.findMany({
        // Çağrı tipi filtresi bilerek uygulanmıyor: Stem Cell/Premium yapıları
        // gereği hep ikinci görüşmede sunulur.
        where: { evaluation: { ...dateFilter, callType: "SECOND_CALL", ...roleFilter, ...agentFilter } },
        // score, kusursuz puan kuralı için gerekli (bkz. upsellRate)
        select: { stemCell: true, premium: true, evaluation: { select: { score: true } } },
      }),
      prisma.evaluation.count({
        where: { ...dateFilter, callType: "SECOND_CALL", evaluationUpsell: { is: null }, ...roleFilter, ...agentFilter },
      }),
      prisma.user.findMany({ select: { id: true, name: true, role: true, isActive: true, email: true } }),
      isAll
        ? prisma.okrBottomSeller.findMany({ select: { month: true, userId: true } })
        : prisma.okrBottomSeller.findMany({ where: { month }, select: { month: true, userId: true } }),
    ]);

    const names = new Map(users.map((u) => [u.id, u.name]));

    // Alt-5 seçicisi yalnızca gerçek danışmanları göstermeli. Fireflies
    // senkronizasyonu, konuşmacısı eşleşmeyen çağrılar için "Atanmamış" adlı
    // AGENT rolünde kalıcı bir yer tutucu hesap açıyor (bkz.
    // app/api/calls/sync-fireflies/route.ts) — rolü gerçekten AGENT olduğu için
    // rol filtresi tek başına elemiyor, e-posta ile ayrıca dışlanıyor.
    //
    // Pasif hesaplar BİLEREK dışlanmıyor: ayrıldığı ay hâlâ ekipteydi ve o ayın
    // en düşük 5'ine girmesi gerekebilir. Sonraki aylarda listede seçili kalsa
    // bile o ayda çağrısı olmadığı için bottomSellersValue onu ortalamaya
    // katmıyor (bkz. app/lib/okr.test.ts "işten ayrılan danışman").
    const eligible = new Set(
      users.filter((u) => u.role === "AGENT" && u.email !== UNASSIGNED_AGENT_EMAIL).map((u) => u.id)
    );
    const inactiveIds = users.filter((u) => !u.isActive).map((u) => u.id);
    const isInactive = new Set(inactiveIds);

    // Çağrı tipi alt-5'i de etkiler; danışman filtresi etkilemez.
    const scopedByCallType = filterEvaluations(evaluations, { callType, agentIds: [] });
    const qualityRows = filterEvaluations(evaluations, { callType, agentIds });

    const allAverages = agentAverages(scopedByCallType, names);
    // agentById bilerek FİLTRESİZ listeden kurulur: geçmiş bir ayda kaydedilmiş
    // seçim, kişi sonradan pasifleştirilse bile o ayki skorunu göstermeye devam
    // etmeli — aksi halde geçmiş OKR değeri sessizce değişir.
    const agentById = new Map(allAverages.map((a) => [a.id, a]));
    const agents = allAverages.filter((a) => eligible.has(a.id));

    const bottomSellers = isAll
      ? cumulativeBottomSellers(scopedByCallType, savedRows, names)
      : await monthlyBottomSellers(month, savedRows, agentById, names);

    const typedUpsell = upsellRows.map(r => ({
      stemCell: r.stemCell as UpsellStatus,
      premium: r.premium as UpsellStatus,
      score: r.evaluation.score,
    }));

    return NextResponse.json({
      month,
      isAll,
      callType,
      agentIds,
      availableMonths: [ALL_MONTHS, ...monthsBetween(FIRST_DATA_MONTH, nowMonth).reverse()],
      quality: { value: averageScore(qualityRows), count: qualityRows.length },
      stemCell: upsellRate(typedUpsell, "stemCell"),
      premium: upsellRate(typedUpsell, "premium"),
      bottomSellers,
      pendingCount,
      agents,
      // Danışman filtresinin listesi seçili aydan/filtreden bağımsız olmalı,
      // yoksa filtrelenen kişi listeden düşüp geri alınamaz hale gelir.
      // Alt-5 seçicisinden (eligible) bilerek ayrı: burada sayılan kümenin
      // TAMAMI listelenir (TEAM_LEADER'lar, "Atanmamış" ve pasif hesaplar
      // dahil), aksi halde listedeki herkesi seçmek "filtre yok" ile aynı
      // sonucu vermezdi. Pasif hesapların değerlendirmeleri toplamlara dahil
      // — çağrılar gerçekten yapıldı ve Raporlarım da onları sayıyor; kişi
      // sonradan pasifleşince geçmiş ayın OKR rakamı değişmesin diye.
      filterAgents: users
        .filter((u) => (REPORTABLE_ROLES as readonly string[]).includes(u.role))
        .map((u) => ({ id: u.id, name: u.name }))
        .sort((a, b) => {
          const aOut = isInactive.has(a.id), bOut = isInactive.has(b.id);
          return aOut === bOut ? a.name.localeCompare(b.name, "tr") : Number(aOut) - Number(bOut);
        }),
      // Arayüz pasif kişileri "(pasif)" diye etiketleyebilsin diye tek liste:
      // hem filtre hem alt-5 seçicisi hem kayıtlı seçim satırları kullanıyor.
      inactiveIds,
    });
  } catch (e) {
    console.error("[GET /api/okr]", e);
    return NextResponse.json({ error: "OKR verileri yüklenemedi." }, { status: 500 });
  }
}

interface BottomSellersResult {
  value: number | null;
  inheritedFrom: string | null;
  selected: AgentAverage[];
  monthly: { month: string; value: number | null }[];
}

/** Tek ay: kaydedilmiş seçim yoksa önceki aydan öner (kaydedilmez, önseçili gelir). */
async function monthlyBottomSellers(
  month: string,
  savedRows: { userId: string }[],
  agentById: Map<string, AgentAverage>,
  names: Map<string, string>
): Promise<BottomSellersResult> {
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
  return { value: bottomSellersValue(selected), inheritedFrom, selected, monthly: [] };
}

/**
 * Tüm aylar: her ayın kendi alt-5 listesi olduğu için havuzlanamaz — ay ay
 * hesaplanıp ortalanır. Yalnızca kaydedilmiş seçimi olan aylar sayılır;
 * devralma (önceki aydan öneri) burada uygulanmaz, kaydedilmemiş bir öneri
 * kümülatif değeri etkilememeli.
 */
function cumulativeBottomSellers(
  rows: { agentId: string; score: number; callDate: Date }[],
  savedRows: { month: string; userId: string }[],
  names: Map<string, string>
): BottomSellersResult {
  const idsByMonth = new Map<string, string[]>();
  for (const r of savedRows) {
    const bucket = idsByMonth.get(r.month);
    if (bucket) bucket.push(r.userId);
    else idsByMonth.set(r.month, [r.userId]);
  }

  const rowsByMonth = groupByTrMonth(rows);
  const monthly = [...idsByMonth.keys()].sort().map((m) => {
    const averages = new Map(
      agentAverages(rowsByMonth.get(m) ?? [], names).map((a) => [a.id, a])
    );
    const selected: AgentAverage[] = (idsByMonth.get(m) ?? []).map(
      (id) => averages.get(id) ?? { id, name: names.get(id) ?? id, avgScore: null, callCount: 0 }
    );
    return { month: m, value: bottomSellersValue(selected) };
  });

  return {
    value: averageOfValues(monthly.map((m) => m.value)),
    inheritedFrom: null,
    selected: [],
    monthly,
  };
}
