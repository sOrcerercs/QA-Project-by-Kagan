import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { resolveScopedAgentIds, REPORTABLE_ROLES } from "@/app/lib/reportScope";
import { parseWeekKey, weekStart, weekEnd, isoWeekKey } from "@/app/lib/isoWeek";
import {
  buildBriefing,
  enrichPicks,
  type BriefingEval,
  type AgentBriefing,
  type CriterionStat,
} from "@/app/lib/coachingBriefing";
import { Prisma } from "@/app/generated/prisma";
import type { Lang } from "@/app/lib/i18n";

/**
 * Haftalık koçluk brifingi.
 *
 * Saklanmaz, her istekte hesaplanır: aynı hafta + aynı veri → aynı brifing.
 * Yeni tablo ve LLM çağrısı YOK; seçim app/lib/coachingBriefing.ts'te saf
 * fonksiyonlarda yapılıyor, burası yalnızca yetki ve veri toplama.
 */

/**
 * Tavan bilerek yazılı: sessiz zaman aşımını gürültülü hataya çevirir
 * (bkz. CLAUDE.md — bu kod tabanında bir kez gerçek regresyona sebep oldu).
 * Sorgular ölçülüp bölündükten sonra normal koşuda buna yaklaşılmıyor;
 * tavan yine de bir emniyet ağı olarak duruyor.
 *
 * NOT: geçmiş satırlarında reportData çekmeden geçilemez. isScorable()
 * puanlanamayan çağrıyı reportData.scorable'dan okuyor ve buildBriefing
 * history'yi de bu filtreden geçiriyor; dar bir geçmiş sorgusu o filtreyi
 * sessizce etkisizleştirir ve ortalamayı yeniden bozardı.
 */
export const maxDuration = 60;

/** Tekrar sinyalinin okunduğu geçmiş pencere; brifing haftası dahil. */
const WINDOW_WEEKS = 4;

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Oturum bulunamadı." }, { status: 401 });

  const params = req.nextUrl.searchParams;

  // Geçersiz değer sessizce varsayılana DÜŞMEZ; 400 döner.
  const weekParam = params.get("week");
  const range = weekParam ? parseWeekKey(weekParam) : { start: weekStart(new Date()), end: weekEnd(new Date()) };
  if (!range) return NextResponse.json({ error: "Geçersiz week. Beklenen biçim: YYYY-Www" }, { status: 400 });

  // Kanıt etiketleri ve "ne demeliydi" satırı karttan dile duyarlı okunuyor;
  // bu yüzden dil route sınırını geçmek zorunda. Geçersiz değer sessizce
  // varsayılana DÜŞMEZ; 400 döner.
  const langParam = params.get("lang");
  if (langParam !== null && langParam !== "tr" && langParam !== "en") {
    return NextResponse.json({ error: "Geçersiz lang. Beklenen: tr veya en" }, { status: 400 });
  }
  const lang: Lang = langParam ?? "tr";

  const requestedIds = (params.get("agentIds") ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const { scopedAgentIds, error } = await resolveScopedAgentIds(user, requestedIds);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const weekKey = isoWeekKey(range.start);
  const historyStart = new Date(range.start);
  historyStart.setDate(historyStart.getDate() - (WINDOW_WEEKS - 1) * 7);

  const base = {
    week: weekKey,
    weekStart: range.start.toISOString(),
    weekEnd: range.end.toISOString(),
    windowWeeks: WINDOW_WEEKS,
  };

  if (scopedAgentIds !== null && scopedAgentIds.length === 0) {
    return NextResponse.json({ ...base, agents: [] });
  }

  try {
    // ── Neden dört ucuz sorgu, tek geniş sorgu değil ────────────────────────
    // ÖLÇÜLDÜ (prod, 1149 satır): aynı satırların skalerleri 0.6 sn,
    // + weakCriteria 18 sn, + reportData 68 sn. Maliyet taramada değil, JSONB
    // kolonlarını çekmekte (TOAST + aktarım). Tek geniş sorgu en büyük takımda
    // ve ADMIN görünümünde 60 sn tavanını aşıyordu.
    //
    // Bu yüzden: JSONB yalnızca gerektiği yerde çekilir.
    //   1) kadro            — skaler
    //   2) kriter özeti     — SQL'de agregat, weakCriteria hiç çekilmez
    //   3) geçmiş skorlar   — skaler
    //   4) haftanın satırları — weakCriteria evet, reportData HAYIR
    //   5) seçilenlerin bloğu — yalnızca ~4 satır/danışman
    //
    // `scorable` elemesi de SQL'de: puanlanamayan çağrı (telesekreter, yanlış
    // numara) score 0 ile kaydediliyor ve elenmezse iki negatif seçiciyi birden
    // kazanıp kanıtsız geliyor. Bellekte elemek blok okumayı gerektirirdi.
    const scopeWhere = scopedAgentIds ? { agentId: { in: scopedAgentIds } } : {};

    // Puanlanamayan çağrılar id ile elenir, `NOT { path: ["scorable"] }` ile DEĞİL.
    // NEDEN: blokların çoğunda 'scorable' anahtarı hiç yok; o zaman
    // reportData->'scorable' NULL olur, NOT(NULL = false) → NULL, ve satır
    // SESSİZCE düşer. ÖLÇÜLDÜ: 1149 satırın 686'sı bu şekilde kayboluyordu —
    // yani geçmişin %60'ı. Pozitif yön (path = false) null-güvenli, o yüzden
    // önce elenecekleri buluyoruz. Küçük bir küme: prod'da 28 günde 17 kayıt.
    const unscorable = await prisma.evaluation.findMany({
      where: {
        callDate: { gte: historyStart, lte: range.end },
        ...scopeWhere,
        reportData: { path: ["scorable"], equals: false },
      },
      select: { id: true },
    });
    const scorableOnly = unscorable.length
      ? { id: { notIn: unscorable.map((u) => u.id) } }
      : {};

    const [roster, criterionRows, historyRows, weekRows] = await Promise.all([
      // 1) Kadro satırlardan DEĞİL, kullanıcı tablosundan. Dört haftadır hiç
      //    çağrı yapmamış danışman 1-1'de en yüksek sinyalli kişidir.
      prisma.user.findMany({
        where: scopedAgentIds
          ? { id: { in: scopedAgentIds } }
          : { role: { in: [...REPORTABLE_ROLES] }, isActive: true },
        select: { id: true, name: true },
      }),

      // 2) Kriter tekrarı: jsonb_array_elements ile veritabanında sayılır.
      prisma.$queryRaw<Array<{
        agentId: string; criterionId: string; label: string;
        occurrences: bigint; avgScore: number;
      }>>`
        SELECT e."agentId"                              AS "agentId",
               elem->>'id'                              AS "criterionId",
               COALESCE(MIN(elem->>'label'), elem->>'id') AS "label",
               COUNT(*)                                 AS "occurrences",
               AVG(COALESCE((elem->>'score')::numeric, 0))::float8 AS "avgScore"
        FROM "Evaluation" e
        CROSS JOIN LATERAL jsonb_array_elements(e."weakCriteria") AS elem
        WHERE e."callDate" >= ${historyStart}
          AND e."callDate" <= ${range.end}
          AND e."unassigned" = false
          AND jsonb_typeof(e."weakCriteria") = 'array'
          AND (e."reportData" -> 'scorable') IS DISTINCT FROM 'false'::jsonb
          ${scopedAgentIds ? Prisma.sql`AND e."agentId" = ANY(${scopedAgentIds})` : Prisma.empty}
          AND elem->>'id' IS NOT NULL
        GROUP BY e."agentId", elem->>'id'
      `,

      // 3) Sapma ortalaması için yalnızca skorlar.
      prisma.evaluation.findMany({
        where: { callDate: { gte: historyStart, lte: range.end }, unassigned: false, ...scopeWhere, ...scorableOnly },
        select: { agentId: true, score: true },
      }),

      // 4) Haftanın satırları — kanıt için blok GEREKMİYOR, seçim skordan.
      prisma.evaluation.findMany({
        where: { callDate: { gte: range.start, lte: range.end }, unassigned: false, ...scopeWhere, ...scorableOnly },
        select: {
          id: true, customerName: true, callDate: true, score: true,
          weakCriteria: true, coachingDone: true, agentId: true,
          agent: { select: { name: true } },
        },
        orderBy: { callDate: "desc" },
      }),
    ]);

    const perAgent = new Map<string, {
      name: string; week: BriefingEval[]; stats: CriterionStat[]; scores: number[];
    }>();
    for (const m of roster) perAgent.set(m.id, { name: m.name, week: [], stats: [], scores: [] });
    const entry = (id: string, fallbackName: string) => {
      const e = perAgent.get(id) ?? { name: fallbackName, week: [], stats: [], scores: [] };
      perAgent.set(id, e);
      return e;
    };

    for (const r of criterionRows) {
      entry(r.agentId, "").stats.push({
        criterionId: r.criterionId,
        label: r.label ?? r.criterionId,
        occurrences: Number(r.occurrences),
        avgScore: r.avgScore ?? 0,
      });
    }
    for (const r of historyRows) entry(r.agentId, "").scores.push(r.score);
    for (const r of weekRows) {
      entry(r.agentId, r.agent.name).week.push({
        id: r.id,
        customerName: r.customerName,
        callDate: r.callDate.toISOString(),
        score: r.score,
        weakCriteria: r.weakCriteria,
        reportData: null, // blok bu aşamada YOK; seçimden sonra çekilir
        coachingDone: r.coachingDone,
      });
    }

    const selected: AgentBriefing[] = [...perAgent.entries()]
      .map(([agentId, v]) =>
        buildBriefing({
          agentId,
          agentName: v.name,
          week: v.week,
          history: v.stats,
          historyScores: v.scores,
          windowWeeks: WINDOW_WEEKS,
          lang,
        })
      )
      .sort((a, b) => a.agentName.localeCompare(b.agentName, "tr"));

    // 5) Yalnızca SEÇİLEN satırların bloğu — danışman başına en fazla 4.
    const pickedIds = selected.flatMap((a) => a.picks.map((p) => p.evaluationId));
    const details = new Map<string, { reportData: unknown; weakCriteria: unknown }>();
    if (pickedIds.length > 0) {
      const blocks = await prisma.evaluation.findMany({
        where: { id: { in: pickedIds } },
        select: { id: true, reportData: true, weakCriteria: true },
      });
      for (const b of blocks) details.set(b.id, { reportData: b.reportData, weakCriteria: b.weakCriteria });
    }

    const agents = enrichPicks(selected, details, lang);

    return NextResponse.json({ ...base, agents });
  } catch (err) {
    console.error("[coaching-briefing]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
