import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { callGemini } from "@/app/lib/gemini";

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get("agentId");
  const lang = (req.nextUrl.searchParams.get("lang") ?? "tr") as "tr" | "en";

  if (!agentId) return NextResponse.json({ error: "agentId zorunlu." }, { status: 400 });

  // Auth: AGENT sadece kendini görebilir
  if (user.role === "AGENT" && agentId !== user.id) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  // TEAM_LEADER sadece kendi takımını görebilir
  if (user.role === "TEAM_LEADER" && agentId !== user.id) {
    const leadingTeam = await prisma.team.findUnique({
      where: { leaderId: user.id },
      select: { id: true },
    });
    const target = await prisma.user.findUnique({ where: { id: agentId }, select: { teamId: true } });
    if (!leadingTeam || target?.teamId !== leadingTeam.id) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
    }
  }

  try {
    // 1. Cache check
    const cached = await prisma.coachingSummary.findUnique({ where: { agentId } });
    if (cached?.summary) {
      return NextResponse.json({
        summary: cached.summary,
        actionItems: cached.actionItems as string[],
        generatedAt: cached.generatedAt,
        evalCount: cached.evalCount,
      });
    }

    // 2. Data window: last 10 days if >=10 evals, else last 10 evals
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const recentEvals = await prisma.evaluation.findMany({
      where: { agentId, callDate: { gte: tenDaysAgo } },
      orderBy: { callDate: "desc" },
    });
    const evals =
      recentEvals.length >= 10
        ? recentEvals
        : await prisma.evaluation.findMany({
            where: { agentId },
            orderBy: { callDate: "desc" },
            take: 10,
          });

    if (evals.length === 0) {
      return NextResponse.json({ error: "Yeterli değerlendirme yok." }, { status: 404 });
    }

    // 3. avgSectionScores
    const withSections = evals.filter(
      (e) => e.sectionScores && typeof e.sectionScores === "object"
    );
    let avgSectionScores: { A: number; B: number; C: number } | null = null;
    if (withSections.length > 0) {
      const totals = withSections.reduce(
        (acc, e) => {
          const ss = e.sectionScores as { A: number; B: number; C: number };
          return { A: acc.A + (ss.A || 0), B: acc.B + (ss.B || 0), C: acc.C + (ss.C || 0) };
        },
        { A: 0, B: 0, C: 0 }
      );
      const n = withSections.length;
      avgSectionScores = {
        A: Math.round(totals.A / n),
        B: Math.round(totals.B / n),
        C: Math.round(totals.C / n),
      };
    }

    // 4. topWeakCriteria (top 3 by frequency)
    const criteriaMap: Record<
      string,
      { label: string; totalScore: number; count: number; coachingNote: string }
    > = {};
    for (const e of evals) {
      if (!Array.isArray(e.weakCriteria)) continue;
      for (const c of e.weakCriteria as Array<{
        id: string;
        label: string;
        score: number;
        coachingNote?: string;
      }>) {
        if (!criteriaMap[c.id]) {
          criteriaMap[c.id] = {
            label: c.label,
            totalScore: 0,
            count: 0,
            coachingNote: c.coachingNote ?? "",
          };
        }
        criteriaMap[c.id].totalScore += c.score;
        criteriaMap[c.id].count += 1;
      }
    }
    const topWeakCriteria = Object.entries(criteriaMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 3)
      .map(([, v]) => ({
        label: v.label,
        avgScore: Math.round(v.totalScore / v.count),
        count: v.count,
        coachingNote: v.coachingNote,
      }));

    // 5. weeklyProgress (last 4 weeks)
    const now = new Date();
    const weeklyProgress = [];
    for (let w = 3; w >= 0; w--) {
      const weekStart = new Date(now);
      weekStart.setDate(weekStart.getDate() - (w * 7 + now.getDay()));
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      const weekEvals = evals.filter((e) => {
        const d = new Date(e.callDate);
        return d >= weekStart && d < weekEnd;
      });
      weeklyProgress.push({
        week: `Week ${4 - w}`,
        score:
          weekEvals.length > 0
            ? Math.round(weekEvals.reduce((s, e) => s + e.score, 0) / weekEvals.length)
            : 0,
        calls: weekEvals.length,
      });
    }

    const windowNote =
      recentEvals.length >= 10
        ? lang === "tr"
          ? "Son 10 günün değerlendirmeleri"
          : "Last 10 days of evaluations"
        : lang === "tr"
        ? `Son ${evals.length} değerlendirme`
        : `Last ${evals.length} evaluations`;

    // 6. Gemini prompt
    const systemPrompt =
      lang === "tr"
        ? "Sen deneyimli bir satış koçusun. Danışman performans verilerini analiz edip yapıcı, motive edici gelişim özeti ve somut aksiyon maddeleri üretiyorsun. Yanıtın yalnızca geçerli JSON olmalı, başka hiçbir şey içermemeli."
        : "You are an experienced sales coach. You analyze consultant performance data and produce constructive, motivating development summaries with concrete action items. Your response must be valid JSON only, nothing else.";

    const userMessage = JSON.stringify({
      evalCount: evals.length,
      windowNote,
      avgSectionScores,
      topWeakCriteria,
      weeklyProgress,
      lang,
      instruction:
        lang === "tr"
          ? "Yukarıdaki verilere dayanarak danışman için 3-4 cümlelik yapıcı bir gelişim özeti ve 2-3 somut, bu hafta uygulanabilir aksiyon maddesi üret. Suçlayıcı değil, motive edici bir dil kullan. Sadece şu JSON formatında döndür: {\"summary\": \"...\", \"actionItems\": [\"...\", \"...\"]}"
          : "Based on the above data, generate a 3-4 sentence constructive development summary and 2-3 concrete, actionable items for this week. Use motivating, not blaming language. Return only this JSON format: {\"summary\": \"...\", \"actionItems\": [\"...\", \"...\"]}",
    });

    const raw = await callGemini(systemPrompt, userMessage, {
      maxTokens: 1024,
      temperature: 0.4,
    });

    // Strip markdown code fences if present
    const cleaned = raw
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "")
      .trim();
    const parsed = JSON.parse(cleaned) as { summary: string; actionItems: string[] };

    // 7. Upsert to DB
    const record = await prisma.coachingSummary.upsert({
      where: { agentId },
      create: {
        agentId,
        summary: parsed.summary,
        actionItems: parsed.actionItems,
        generatedAt: new Date(),
        evalCount: evals.length,
      },
      update: {
        summary: parsed.summary,
        actionItems: parsed.actionItems,
        generatedAt: new Date(),
        evalCount: evals.length,
      },
    });

    return NextResponse.json({
      summary: record.summary,
      actionItems: record.actionItems as string[],
      generatedAt: record.generatedAt,
      evalCount: record.evalCount,
    });
  } catch (err) {
    console.error("[coaching-summary]", err);
    return NextResponse.json({ error: "Özet oluşturulamadı." }, { status: 500 });
  }
}
