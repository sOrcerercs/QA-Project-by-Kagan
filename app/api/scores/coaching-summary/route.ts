import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { callGemini } from "@/app/lib/gemini";
import { extractSummaryJson, isCoachingSummaryFresh } from "@/app/lib/coachingSummary";

export const maxDuration = 60;

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
    try {
      const leadingTeam = await prisma.team.findUnique({
        where: { leaderId: user.id },
        select: { id: true },
      });
      const target = await prisma.user.findUnique({ where: { id: agentId }, select: { teamId: true } });
      if (!leadingTeam || target?.teamId !== leadingTeam.id) {
        return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
      }
    } catch {
      return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
    }
  }

  let cached: Awaited<ReturnType<typeof prisma.coachingSummary.findUnique>> = null;
  try {
    cached = await prisma.coachingSummary.findUnique({ where: { agentId } });

    // Veri penceresi: >=10 ise son 10 gün, değilse son 10 değerlendirme
    const tenDaysAgo = new Date();
    tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);
    const recentEvals = await prisma.evaluation.findMany({
      where: { agentId, callDate: { gte: tenDaysAgo } },
      orderBy: { callDate: "desc" },
    });
    const evals =
      recentEvals.length >= 10
        ? recentEvals
        : await prisma.evaluation.findMany({ where: { agentId }, orderBy: { callDate: "desc" }, take: 10 });
    const currentCount = evals.length;

    // Taze cache → anında döndür
    if (isCoachingSummaryFresh(cached, currentCount)) {
      return NextResponse.json({
        summary: cached!.summary,
        actionItems: Array.isArray(cached!.actionItems) ? (cached!.actionItems as string[]) : [],
        generatedAt: cached!.generatedAt,
        evalCount: cached!.evalCount,
        stale: false,
      });
    }

    // Üretim için veri yok
    if (currentCount === 0) {
      if (cached?.summary) {
        return NextResponse.json({
          summary: cached.summary,
          actionItems: Array.isArray(cached.actionItems) ? (cached.actionItems as string[]) : [],
          generatedAt: cached.generatedAt,
          evalCount: cached.evalCount,
          stale: true,
        });
      }
      return NextResponse.json({ error: "Yeterli değerlendirme yok." }, { status: 404 });
    }

    // 3. avgSectionScores
    let avgSectionScores: { A: number; B: number; C: number } | null = null;
    const validSections: { A: number; B: number; C: number }[] = [];
    for (const e of evals) {
      if (!e.sectionScores || typeof e.sectionScores !== "object" || Array.isArray(e.sectionScores)) continue;
      const ss = e.sectionScores as Record<string, unknown>;
      if (typeof ss.A !== "number" || typeof ss.B !== "number" || typeof ss.C !== "number") continue;
      validSections.push({ A: ss.A, B: ss.B, C: ss.C });
    }
    if (validSections.length > 0) {
      const totals = validSections.reduce(
        (acc, ss) => ({ A: acc.A + ss.A, B: acc.B + ss.B, C: acc.C + ss.C }),
        { A: 0, B: 0, C: 0 }
      );
      const n = validSections.length;
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
      weekStart.setDate(weekStart.getDate() - (w + 1) * 7);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(now);
      weekEnd.setDate(weekEnd.getDate() - w * 7);
      weekEnd.setHours(0, 0, 0, 0);
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

    // Sağlamlaştırılmış, bütçeli üretim
    let generated: { summary: string; actionItems: string[] };
    try {
      const raw = await callGemini(systemPrompt, userMessage, {
        maxTokens: 1536,
        temperature: 0.4,
        timeoutMs: 15000,
        maxAttempts: 2,
        maxSleepMs: 5000,
      });
      generated = extractSummaryJson(raw);
    } catch (genErr) {
      console.error("[coaching-summary] üretim başarısız:", genErr);
      // Stale-while-revalidate: elde son iyi özet varsa onu döndür (hata değil)
      if (cached?.summary) {
        return NextResponse.json({
          summary: cached.summary,
          actionItems: Array.isArray(cached.actionItems) ? (cached.actionItems as string[]) : [],
          generatedAt: cached.generatedAt,
          evalCount: cached.evalCount,
          stale: true,
        });
      }
      return NextResponse.json({ error: "Özet şu anda hazırlanamadı, birazdan tekrar deneyin." }, { status: 503 });
    }

    const record = await prisma.coachingSummary.upsert({
      where: { agentId },
      create: {
        agentId,
        summary: generated.summary,
        actionItems: generated.actionItems,
        generatedAt: new Date(),
        evalCount: currentCount,
      },
      update: {
        summary: generated.summary,
        actionItems: generated.actionItems,
        generatedAt: new Date(),
        evalCount: currentCount,
      },
    });

    return NextResponse.json({
      summary: record.summary,
      actionItems: Array.isArray(record.actionItems) ? (record.actionItems as string[]) : [],
      generatedAt: record.generatedAt,
      evalCount: record.evalCount,
      stale: false,
    });
  } catch (err) {
    console.error("[coaching-summary]", err);
    // Beklenmedik hatada da elde özet varsa onu göster
    if (cached?.summary) {
      return NextResponse.json({
        summary: cached.summary,
        actionItems: Array.isArray(cached.actionItems) ? (cached.actionItems as string[]) : [],
        generatedAt: cached.generatedAt,
        evalCount: cached.evalCount,
        stale: true,
      });
    }
    return NextResponse.json({ error: "Özet oluşturulamadı." }, { status: 500 });
  }
}
