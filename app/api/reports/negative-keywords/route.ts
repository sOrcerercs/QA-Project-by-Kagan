import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

function extractSnippet(transcript: string, word: string): string {
  const lower = transcript.toLowerCase();
  const idx = lower.indexOf(word);
  if (idx === -1) return "";
  const start = Math.max(0, idx - 80);
  const end = Math.min(transcript.length, idx + word.length + 80);
  return (start > 0 ? "…" : "") + transcript.slice(start, end) + (end < transcript.length ? "…" : "");
}

function countHits(transcript: string, word: string): number {
  const lower = transcript.toLowerCase();
  let count = 0;
  let pos = 0;
  while ((pos = lower.indexOf(word, pos)) !== -1) {
    count++;
    pos += word.length;
  }
  return count;
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || (user.role !== "ADMIN" && user.role !== "MANAGER")) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { searchParams } = req.nextUrl;
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  try {
    const keywords = await prisma.negativeKeyword.findMany({
      orderBy: { createdAt: "asc" },
      select: { id: true, word: true },
    });

    if (keywords.length === 0) {
      return NextResponse.json({
        results: [],
        totalEvaluationsScanned: 0,
        dateRange: { start: startDate, end: endDate },
      });
    }

    const dateFilter = startDate || endDate
      ? {
          callDate: {
            ...(startDate && { gte: new Date(startDate) }),
            ...(endDate && { lte: new Date(endDate + "T23:59:59.999Z") }),
          },
        }
      : {};

    const evaluations = await prisma.evaluation.findMany({
      where: dateFilter,
      select: {
        id: true,
        transcript: true,
        callDate: true,
        agent: { select: { name: true } },
      },
      orderBy: { callDate: "desc" },
    });

    const results = keywords.map((kw) => {
      const word = kw.word; // already lowercase from storage
      const matches: Array<{
        evaluationId: string;
        agentName: string;
        callDate: string;
        snippet: string;
      }> = [];
      let totalHits = 0;
      const agentSet = new Set<string>();

      for (const ev of evaluations) {
        const hits = countHits(ev.transcript, word);
        if (hits === 0) continue;
        totalHits += hits;
        const agentName = ev.agent?.name ?? "Bilinmiyor";
        agentSet.add(agentName);
        matches.push({
          evaluationId: ev.id,
          agentName,
          callDate: ev.callDate.toISOString(),
          snippet: extractSnippet(ev.transcript, word),
        });
      }

      return {
        keywordId: kw.id,
        word: kw.word,
        callCount: matches.length,
        totalHits,
        agentNames: Array.from(agentSet),
        matches,
      };
    });

    return NextResponse.json({
      results,
      totalEvaluationsScanned: evaluations.length,
      dateRange: { start: startDate, end: endDate },
    });
  } catch (err) {
    console.error("[negative-keywords report]", err);
    return NextResponse.json({ error: "Sunucu hatası." }, { status: 500 });
  }
}
