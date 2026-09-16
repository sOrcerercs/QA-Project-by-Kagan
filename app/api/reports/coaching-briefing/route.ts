import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { resolveScopedAgentIds, REPORTABLE_ROLES } from "@/app/lib/reportScope";
import { parseWeekKey, weekStart, weekEnd, isoWeekKey } from "@/app/lib/isoWeek";
import { buildBriefing, type BriefingEval, type AgentBriefing } from "@/app/lib/coachingBriefing";
import type { Lang } from "@/app/lib/i18n";

/**
 * Haftalık koçluk brifingi.
 *
 * Saklanmaz, her istekte hesaplanır: aynı hafta + aynı veri → aynı brifing.
 * Yeni tablo ve LLM çağrısı YOK; seçim app/lib/coachingBriefing.ts'te saf
 * fonksiyonlarda yapılıyor, burası yalnızca yetki ve veri toplama.
 */

/**
 * Depodaki en geniş okuma sorgularından biri: 4 hafta × kapsanan tüm
 * danışmanlar × tam reportData JSONB. ADMIN kapsamında bu tüm organizasyon
 * (~750 satır) ve bu predicate'i karşılayan indeks yok. Vercel Hobby tavanı
 * zaten 60 sn; tavanı yazmak sessiz zaman aşımını gürültülü hataya çevirir
 * (bkz. CLAUDE.md — bu kod tabanında bir kez gerçek regresyona sebep oldu).
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
    const rows = await prisma.evaluation.findMany({
      where: {
        callDate: { gte: historyStart, lte: range.end },
        unassigned: false,
        ...(scopedAgentIds ? { agentId: { in: scopedAgentIds } } : {}),
      },
      select: {
        id: true,
        customerName: true,
        callDate: true,
        score: true,
        weakCriteria: true,
        reportData: true,
        coachingDone: true,
        agentId: true,
        agent: { select: { name: true } },
      },
      orderBy: { callDate: "desc" },
    });

    // Kadro satırlardan DEĞİL, kullanıcı tablosundan tohumlanır. Dört haftadır
    // hiç çağrı yapmamış danışman 1-1'de konuşulacak en yüksek sinyalli kişidir;
    // satırlardan kurulsa ekranda hiç görünmezdi. Spec'in "sıfır çağrı hata
    // değil, boş ekran değil" kuralı ancak böyle uçtan uca sağlanıyor.
    const roster = await prisma.user.findMany({
      where: scopedAgentIds
        ? { id: { in: scopedAgentIds } }
        : { role: { in: [...REPORTABLE_ROLES] }, isActive: true },
      select: { id: true, name: true },
    });

    const perAgent = new Map<string, { name: string; all: BriefingEval[] }>();
    for (const m of roster) perAgent.set(m.id, { name: m.name, all: [] });
    for (const r of rows) {
      const entry = perAgent.get(r.agentId) ?? { name: r.agent.name, all: [] };
      entry.all.push({
        id: r.id,
        customerName: r.customerName,
        callDate: r.callDate.toISOString(),
        score: r.score,
        weakCriteria: r.weakCriteria,
        reportData: r.reportData,
        coachingDone: r.coachingDone,
      });
      perAgent.set(r.agentId, entry);
    }

    const agents: AgentBriefing[] = [...perAgent.entries()]
      .map(([agentId, { name, all }]) =>
        buildBriefing({
          agentId,
          agentName: name,
          week: all.filter((e) => new Date(e.callDate) >= range.start),
          history: all,
          windowWeeks: WINDOW_WEEKS,
          lang,
        })
      )
      .sort((a, b) => a.agentName.localeCompare(b.agentName, "tr"));

    return NextResponse.json({ ...base, agents });
  } catch (err) {
    console.error("[coaching-briefing]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
