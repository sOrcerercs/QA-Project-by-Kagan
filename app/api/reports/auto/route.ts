import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { resolveScopedAgentIds, REPORTABLE_ROLES } from "@/app/lib/reportScope";
import { aggregateReport } from "@/app/lib/reportAggregation";

// Son 7 günün raporunu otomatik oluşturur (DB'ye kaydetmez, taze veri döner)
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const requestedIds = (req.nextUrl.searchParams.get("agentIds") ?? req.nextUrl.searchParams.get("agentId") ?? "")
    .split(",").map(s => s.trim()).filter(Boolean);

  const { scopedAgentIds, error } = await resolveScopedAgentIds(user, requestedIds);
  if (error) return NextResponse.json({ error: error.message }, { status: error.status });

  const startParam = req.nextUrl.searchParams.get("start");
  const endParam = req.nextUrl.searchParams.get("end");
  const end = endParam ? new Date(endParam + "T23:59:59") : new Date();
  const start = startParam ? new Date(startParam + "T00:00:00") : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  start.setHours(0, 0, 0, 0);

  const evaluations = await prisma.evaluation.findMany({
    where: {
      callDate: { gte: start, lte: end },
      ...(scopedAgentIds && { agentId: { in: scopedAgentIds } }),
      agent: { role: { in: [...REPORTABLE_ROLES] } },
    },
    include: { agent: { select: { id: true, name: true, email: true, teamId: true, team: { select: { name: true } }, role: true, manager: { select: { name: true } } } } },
    orderBy: { callDate: "asc" },
  });

  const allAgents = await prisma.user.findMany({
    where: { role: { in: [...REPORTABLE_ROLES] }, isActive: true },
    select: { id: true, name: true, teamId: true, team: { select: { name: true } } },
  });
  const visibleAgents = scopedAgentIds ? allAgents.filter(a => scopedAgentIds.includes(a.id)) : allAgents;

  const promptRows = await prisma.prompt.findMany({ select: { id: true, name: true } });
  const promptNameById = new Map(promptRows.map(p => [p.id, p.name]));

  const data = aggregateReport({
    evaluations: evaluations as any,
    visibleAgents: visibleAgents.map(a => ({ ...a, role: "AGENT" as const, manager: null })) as any,
    promptNameById,
  });

  if (data.summary.totalEvaluations > 0) {
    return NextResponse.json({ data, period: { start: start.toISOString(), end: end.toISOString() }, isDemo: false });
  }

  // AGENT ve TEAM_LEADER icin demo gosterilmez — bos veri don
  if (user.role === "AGENT" || user.role === "TEAM_LEADER") {
    return NextResponse.json({
      data: {
        consultantPerformance: [],
        promptColumns: [],
        dailyCallBreakdown: [],
        callDurations: [],
        teamDistribution: [],
        consultantCallDistribution: [],
        unlistenedConsultants: [],
        summary: { totalEvaluations: 0, totalSecondCalls: 0, avgScore: 0, highPotential: 0, atRisk: 0 },
      },
      period: { start: start.toISOString(), end: end.toISOString() },
      isDemo: false,
    });
  }

  // Demo veri — sadece ADMIN/MANAGER icin gercek evaluation yokken ornek gosterim
  const demoData = {
    consultantPerformance: [
      { agentId: "d1", name: "Mehmet Akgul",   calls: 12, healthScore: 88.5, byPrompt: [ { promptId: "p_first", promptName: "SDR", avgScore: 84.0, count: 3 }, { promptId: "p_second", promptName: "Estenove Second Call Scorecard", avgScore: 90.2, count: 9 } ] },
      { agentId: "d2", name: "Damla Turkay",   calls: 10, healthScore: 82.0, byPrompt: [ { promptId: "p_first", promptName: "SDR", avgScore: 78.5, count: 2 }, { promptId: "p_second", promptName: "Estenove Second Call Scorecard", avgScore: 83.1, count: 8 } ] },
      { agentId: "d3", name: "Miray Ipek",     calls: 7,  healthScore: 71.0, byPrompt: [ { promptId: "p_second", promptName: "Estenove Second Call Scorecard", avgScore: 71.0, count: 7 } ] },
      { agentId: "d4", name: "Guney Goc",      calls: 7,  healthScore: 85.0, byPrompt: [ { promptId: "p_first", promptName: "SDR", avgScore: 81.5, count: 2 }, { promptId: "p_second", promptName: "Estenove Second Call Scorecard", avgScore: 86.8, count: 5 } ] },
      { agentId: "d5", name: "Didem Ozbek",    calls: 3,  healthScore: 52.0, byPrompt: [ { promptId: "p_first", promptName: "SDR", avgScore: 49.0, count: 1 }, { promptId: "p_second", promptName: "Estenove Second Call Scorecard", avgScore: 53.5, count: 2 } ] },
    ],
    promptColumns: [
      { promptId: "p_first", promptName: "SDR" },
      { promptId: "p_second", promptName: "Estenove Second Call Scorecard" },
    ],
    dailyCallBreakdown: [
      { date: "31 Mart", firstCall: 8, secondCall: 5 },
      { date: "1 Nisan", firstCall: 10, secondCall: 7 },
      { date: "2 Nisan", firstCall: 12, secondCall: 9 },
      { date: "3 Nisan", firstCall: 6, secondCall: 4 },
      { date: "4 Nisan", firstCall: 14, secondCall: 11 },
      { date: "5 Nisan", firstCall: 9, secondCall: 6 },
      { date: "6 Nisan", firstCall: 5, secondCall: 3 },
    ],
    callDurations: [
      { name: "Damla Turkay", calls: 10, totalDuration: "186:20", avgDuration: "18:38" },
      { name: "Miray Ipek", calls: 7, totalDuration: "148:30", avgDuration: "21:13" },
      { name: "Mehmet Akgul", calls: 12, totalDuration: "162:45", avgDuration: "13:33" },
      { name: "Soufiane Slimane", calls: 8, totalDuration: "98:40", avgDuration: "12:20" },
      { name: "Ibrahim Sik", calls: 9, totalDuration: "108:15", avgDuration: "12:01" },
      { name: "Alexandra Boyko", calls: 8, totalDuration: "72:32", avgDuration: "09:04" },
      { name: "Guney Goc", calls: 7, totalDuration: "58:10", avgDuration: "08:18" },
      { name: "Melike Alara Bulut", calls: 6, totalDuration: "42:18", avgDuration: "07:03" },
      { name: "Nurhan Guney", calls: 6, totalDuration: "38:54", avgDuration: "06:29" },
      { name: "Mavican Tekuz", calls: 5, totalDuration: "35:20", avgDuration: "07:04" },
      { name: "Furkan Kirik", calls: 4, totalDuration: "28:44", avgDuration: "07:11" },
      { name: "Sinem Bulur", calls: 3, totalDuration: "22:30", avgDuration: "07:30" },
      { name: "Didem Ozbek", calls: 3, totalDuration: "18:06", avgDuration: "06:02" },
      { name: "Deniz Senavci", calls: 2, totalDuration: "15:42", avgDuration: "07:51" },
      { name: "Emir Ozdemir", calls: 2, totalDuration: "11:20", avgDuration: "05:40" },
    ],
    teamDistribution: [
      { team: "Dilara'nin Takimi", totalCalls: 28, firstCall: 10, secondCall: 18 },
      { team: "Karolina'nin Takimi", totalCalls: 24, firstCall: 8, secondCall: 16 },
      { team: "Takim Liderleri", totalCalls: 18, firstCall: 6, secondCall: 12 },
      { team: "Mehmet'in Takimi", totalCalls: 14, firstCall: 5, secondCall: 9 },
      { team: "Alexandra'nin Takimi", totalCalls: 18, firstCall: 7, secondCall: 11 },
    ],
    consultantCallDistribution: [
      { name: "Mehmet Akgul", totalCalls: 12, firstCall: 3, secondCall: 9 },
      { name: "Damla Turkay", totalCalls: 10, firstCall: 2, secondCall: 8 },
      { name: "Ibrahim Sik", totalCalls: 9, firstCall: 2, secondCall: 7 },
      { name: "Alexandra Boyko", totalCalls: 8, firstCall: 3, secondCall: 5 },
      { name: "Soufiane Slimane", totalCalls: 8, firstCall: 1, secondCall: 7 },
      { name: "Guney Goc", totalCalls: 7, firstCall: 2, secondCall: 5 },
      { name: "Miray Ipek", totalCalls: 7, firstCall: 0, secondCall: 7 },
      { name: "Melike Alara Bulut", totalCalls: 6, firstCall: 2, secondCall: 4 },
      { name: "Nurhan Guney", totalCalls: 6, firstCall: 1, secondCall: 5 },
      { name: "Mavican Tekuz", totalCalls: 5, firstCall: 2, secondCall: 3 },
      { name: "Furkan Kirik", totalCalls: 4, firstCall: 1, secondCall: 3 },
      { name: "Sinem Bulur", totalCalls: 3, firstCall: 1, secondCall: 2 },
      { name: "Didem Ozbek", totalCalls: 3, firstCall: 1, secondCall: 2 },
      { name: "Deniz Senavci", totalCalls: 2, firstCall: 0, secondCall: 2 },
      { name: "Emir Ozdemir", totalCalls: 2, firstCall: 1, secondCall: 1 },
    ],
    unlistenedConsultants: [
      { name: "Kubra Ekmekci", team: "Alexandra'nin Takimi" },
      { name: "Oguzhan Berk", team: "Mehmet'in Takimi" },
      { name: "Ugur Bas", team: "Mehmet'in Takimi" },
      { name: "Tugce Yucelirgil", team: "Dilara'nin Takimi" },
      { name: "Berfin Aydogdu", team: "Karolina'nin Takimi" },
      { name: "Caner Arsal", team: "Takim Liderleri" },
    ],
    summary: {
      totalEvaluations: 102,
      totalSecondCalls: 66,
      avgScore: 72,
      highPotential: 58,
      atRisk: 12,
    },
  };

  return NextResponse.json({
    data: demoData,
    period: { start: start.toISOString(), end: end.toISOString() },
    isDemo: true,
  });
}
