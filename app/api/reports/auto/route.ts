import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

// Son 7 günün raporunu otomatik oluşturur (DB'ye kaydetmez, taze veri döner)
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const agentIdParam = req.nextUrl.searchParams.get("agentId");

  let scopedAgentId: string | null = null;

  // TEAM_LEADER için liderlik ettiği takımı bul (teamId null olabilir)
  let leaderTeamId: string | null = null;
  if (user.role === "TEAM_LEADER") {
    const leadingTeam = await prisma.team.findUnique({
      where: { leaderId: user.id },
      select: { id: true },
    });
    leaderTeamId = leadingTeam?.id ?? null;
  }

  if (agentIdParam) {
    if (user.role === "AGENT") {
      if (agentIdParam !== user.id) {
        return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
      }
      scopedAgentId = user.id;
    } else if (user.role === "TEAM_LEADER") {
      const member = await prisma.user.findFirst({
        where: { id: agentIdParam, teamId: leaderTeamId ?? undefined },
      });
      if (!member) {
        return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
      }
      scopedAgentId = agentIdParam;
    } else {
      scopedAgentId = agentIdParam;
    }
  }

  if (!agentIdParam && user.role === "AGENT") {
    scopedAgentId = user.id;
  }

  // TEAM_LEADER için agentId yoksa takımın tüm üyelerini kapsama al
  let teamScopedIds: string[] | null = null;
  if (!agentIdParam && user.role === "TEAM_LEADER") {
    if (!leaderTeamId) {
      return NextResponse.json({ error: "Takım ataması yapılmamış." }, { status: 403 });
    }
    const teamMembers = await prisma.user.findMany({
      where: { teamId: leaderTeamId },
      select: { id: true },
    });
    teamScopedIds = teamMembers.map(m => m.id);
  }

  const startParam = req.nextUrl.searchParams.get("start");
  const endParam = req.nextUrl.searchParams.get("end");

  const end = endParam ? new Date(endParam + "T23:59:59") : new Date();
  const start = startParam ? new Date(startParam + "T00:00:00") : new Date(end.getTime() - 7 * 24 * 60 * 60 * 1000);
  start.setHours(0, 0, 0, 0);

  const evaluations = await prisma.evaluation.findMany({
    where: {
      createdAt: { gte: start, lte: end },
      ...(scopedAgentId && { agentId: scopedAgentId }),
      ...(teamScopedIds && { agentId: { in: teamScopedIds } }),
    },
    include: {
      agent: {
        select: { id: true, name: true, email: true, teamId: true, team: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const allAgents = await prisma.user.findMany({
    where: { role: "AGENT" },
    select: { id: true, name: true, teamId: true, team: { select: { name: true } } },
  });

  // Scope allAgents to prevent leaking names to non-admin roles
  const visibleAgents = user.role === "ADMIN" || user.role === "MANAGER"
    ? allAgents
    : user.role === "TEAM_LEADER" && teamScopedIds
      ? allAgents.filter(a => teamScopedIds!.includes(a.id))
      : allAgents.filter(a => a.id === user.id);

  // Danışman Performansı (First Call ve Second Call ayrı ayrı)
  const agentMap: Record<string, {
    name: string; calls: number; totalScore: number;
    firstCalls: number; firstTotalScore: number;
    secondCalls: number; secondTotalScore: number;
  }> = {};
  for (const ev of evaluations) {
    const id = ev.agentId;
    if (!agentMap[id]) agentMap[id] = { name: ev.agent.name, calls: 0, totalScore: 0, firstCalls: 0, firstTotalScore: 0, secondCalls: 0, secondTotalScore: 0 };
    agentMap[id].calls++;
    agentMap[id].totalScore += ev.score;
    if (ev.callType === "FIRST_CALL") {
      agentMap[id].firstCalls++;
      agentMap[id].firstTotalScore += ev.score;
    } else {
      agentMap[id].secondCalls++;
      agentMap[id].secondTotalScore += ev.score;
    }
  }
  const consultantPerformance = Object.values(agentMap)
    .map(a => ({
      name: a.name,
      calls: a.calls,
      healthScore: a.calls > 0 ? Math.round((a.totalScore / a.calls) * 10) / 10 : 0,
      firstCallScore: a.firstCalls > 0 ? Math.round((a.firstTotalScore / a.firstCalls) * 10) / 10 : null,
      firstCallCount: a.firstCalls,
      secondCallScore: a.secondCalls > 0 ? Math.round((a.secondTotalScore / a.secondCalls) * 10) / 10 : null,
      secondCallCount: a.secondCalls,
    }))
    .sort((a, b) => b.calls - a.calls);

  // Günlük Çağrı Dağılımı
  const dailyMap: Record<string, { firstCall: number; secondCall: number }> = {};
  for (const ev of evaluations) {
    const dateKey = new Date(ev.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
    if (!dailyMap[dateKey]) dailyMap[dateKey] = { firstCall: 0, secondCall: 0 };
    if (ev.callType === "FIRST_CALL") dailyMap[dateKey].firstCall++;
    else dailyMap[dateKey].secondCall++;
  }
  const dailyCallBreakdown = Object.entries(dailyMap).map(([date, counts]) => ({ date, ...counts }));

  // Çağrı Süreleri
  const durationMap: Record<string, { name: string; calls: number; totalMinutes: number }> = {};
  for (const ev of evaluations) {
    const id = ev.agentId;
    if (!durationMap[id]) durationMap[id] = { name: ev.agent.name, calls: 0, totalMinutes: 0 };
    durationMap[id].calls++;
    const parts = ev.callDuration.split(":");
    if (parts.length === 2) {
      durationMap[id].totalMinutes += parseInt(parts[0]) + parseInt(parts[1]) / 60;
    }
  }
  const callDurations = Object.values(durationMap).map(d => {
    const totalMin = Math.floor(d.totalMinutes);
    const totalSec = Math.round((d.totalMinutes - totalMin) * 60);
    const avgMin = d.calls > 0 ? d.totalMinutes / d.calls : 0;
    const avgMinFloor = Math.floor(avgMin);
    const avgSec = Math.round((avgMin - avgMinFloor) * 60);
    return { name: d.name, calls: d.calls, totalDuration: `${totalMin}:${String(totalSec).padStart(2, "0")}`, avgDuration: `${avgMinFloor}:${String(avgSec).padStart(2, "0")}` };
  }).sort((a, b) => b.calls - a.calls);

  // Takım Dağılımı
  const teamMap: Record<string, { team: string; totalCalls: number; firstCall: number; secondCall: number }> = {};
  for (const ev of evaluations) {
    const teamName = ev.agent.team?.name || "Takimsiz";
    if (!teamMap[teamName]) teamMap[teamName] = { team: teamName, totalCalls: 0, firstCall: 0, secondCall: 0 };
    teamMap[teamName].totalCalls++;
    if (ev.callType === "FIRST_CALL") teamMap[teamName].firstCall++;
    else teamMap[teamName].secondCall++;
  }
  const teamDistribution = Object.values(teamMap).sort((a, b) => b.totalCalls - a.totalCalls);

  // Danışman Çağrı Dağılımı
  const consultantDistMap: Record<string, { name: string; totalCalls: number; firstCall: number; secondCall: number }> = {};
  for (const ev of evaluations) {
    const id = ev.agentId;
    if (!consultantDistMap[id]) consultantDistMap[id] = { name: ev.agent.name, totalCalls: 0, firstCall: 0, secondCall: 0 };
    consultantDistMap[id].totalCalls++;
    if (ev.callType === "FIRST_CALL") consultantDistMap[id].firstCall++;
    else consultantDistMap[id].secondCall++;
  }
  const consultantCallDistribution = Object.values(consultantDistMap).sort((a, b) => b.totalCalls - a.totalCalls);

  // Dinlenmeyen Danışmanlar
  const evaluatedAgentIds = new Set(evaluations.map(e => e.agentId));
  const unlistenedConsultants = visibleAgents
    .filter(a => !evaluatedAgentIds.has(a.id))
    .map(a => ({ name: a.name, team: a.team?.name || "Takimsiz" }));

  // Özet
  const totalEvaluations = evaluations.length;
  const totalSecondCalls = evaluations.filter(e => e.callType === "SECOND_CALL" || !e.callType).length;
  const avgScore = totalEvaluations > 0 ? Math.round(evaluations.reduce((a, e) => a + e.score, 0) / totalEvaluations) : 0;
  const highPotential = evaluations.filter(e => e.score >= 70).length;
  const atRisk = evaluations.filter(e => e.score < 55).length;

  // Gercek veri varsa onu dondur
  if (totalEvaluations > 0) {
    return NextResponse.json({
      data: {
        consultantPerformance, dailyCallBreakdown, callDurations, teamDistribution,
        consultantCallDistribution, unlistenedConsultants,
        summary: { totalEvaluations, totalSecondCalls, avgScore, highPotential, atRisk },
      },
      period: { start: start.toISOString(), end: end.toISOString() },
      isDemo: false,
    });
  }

  // AGENT ve TEAM_LEADER icin demo gosterilmez — bos veri don
  if (user.role === "AGENT" || user.role === "TEAM_LEADER") {
    return NextResponse.json({
      data: {
        consultantPerformance: [],
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
      { name: "Mehmet Akgul",     calls: 12, healthScore: 88.5, firstCallScore: 84.0, firstCallCount: 3, secondCallScore: 90.2, secondCallCount: 9 },
      { name: "Damla Turkay",     calls: 10, healthScore: 82.0, firstCallScore: 78.5, firstCallCount: 2, secondCallScore: 83.1, secondCallCount: 8 },
      { name: "Ibrahim Sik",      calls: 9,  healthScore: 79.3, firstCallScore: 75.0, firstCallCount: 2, secondCallScore: 81.0, secondCallCount: 7 },
      { name: "Alexandra Boyko",  calls: 8,  healthScore: 76.0, firstCallScore: 72.3, firstCallCount: 3, secondCallScore: 78.4, secondCallCount: 5 },
      { name: "Soufiane Slimane", calls: 8,  healthScore: 74.5, firstCallScore: 70.0, firstCallCount: 1, secondCallScore: 75.3, secondCallCount: 7 },
      { name: "Guney Goc",        calls: 7,  healthScore: 85.0, firstCallScore: 81.5, firstCallCount: 2, secondCallScore: 86.8, secondCallCount: 5 },
      { name: "Miray Ipek",       calls: 7,  healthScore: 71.0, firstCallScore: null, firstCallCount: 0, secondCallScore: 71.0, secondCallCount: 7 },
      { name: "Melike Alara Bulut", calls: 6, healthScore: 68.2, firstCallScore: 65.0, firstCallCount: 2, secondCallScore: 70.0, secondCallCount: 4 },
      { name: "Nurhan Guney",     calls: 6,  healthScore: 66.5, firstCallScore: 63.0, firstCallCount: 1, secondCallScore: 67.6, secondCallCount: 5 },
      { name: "Mavican Tekuz",    calls: 5,  healthScore: 63.0, firstCallScore: 60.5, firstCallCount: 2, secondCallScore: 64.7, secondCallCount: 3 },
      { name: "Furkan Kirik",     calls: 4,  healthScore: 61.0, firstCallScore: 58.0, firstCallCount: 1, secondCallScore: 62.3, secondCallCount: 3 },
      { name: "Didem Ozbek",      calls: 3,  healthScore: 52.0, firstCallScore: 49.0, firstCallCount: 1, secondCallScore: 53.5, secondCallCount: 2 },
      { name: "Emir Ozdemir",     calls: 2,  healthScore: 45.0, firstCallScore: 42.0, firstCallCount: 1, secondCallScore: 48.0, secondCallCount: 1 },
      { name: "Sinem Bulur",      calls: 3,  healthScore: 75.0, firstCallScore: 72.0, firstCallCount: 1, secondCallScore: 76.5, secondCallCount: 2 },
      { name: "Deniz Senavci",    calls: 2,  healthScore: 72.0, firstCallScore: null, firstCallCount: 0, secondCallScore: 72.0, secondCallCount: 2 },
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
