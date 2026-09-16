import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { resolveScopedAgentIds } from "@/app/lib/reportScope";
import { parseWeekKey, weekStart, weekEnd, isoWeekKey } from "@/app/lib/isoWeek";
import { buildBriefing, type BriefingEval, type AgentBriefing } from "@/app/lib/coachingBriefing";

/**
 * Haftalık koçluk brifingi.
 *
 * Saklanmaz, her istekte hesaplanır: aynı hafta + aynı veri → aynı brifing.
 * Yeni tablo ve LLM çağrısı YOK; seçim app/lib/coachingBriefing.ts'te saf
 * fonksiyonlarda yapılıyor, burası yalnızca yetki ve veri toplama.
 */

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

    const perAgent = new Map<string, { name: string; all: BriefingEval[] }>();
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
        })
      )
      .sort((a, b) => a.agentName.localeCompare(b.agentName, "tr"));

    return NextResponse.json({ ...base, agents });
  } catch (err) {
    console.error("[coaching-briefing]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
