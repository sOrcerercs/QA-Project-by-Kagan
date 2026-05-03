import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

// Raporları listele
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const reports = await prisma.report.findMany({
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json({ reports: reports.map(r => ({ ...r, data: undefined })) });
}

// Yeni rapor oluştur
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { type, startDate, endDate } = await req.json();

  if (!type || !startDate || !endDate) {
    return NextResponse.json({ error: "Tip, başlangıç ve bitiş tarihi zorunludur." }, { status: 400 });
  }

  const start = new Date(startDate);
  const end = new Date(endDate);

  // Tüm evaluation'ları tarih aralığında çek
  const evaluations = await prisma.evaluation.findMany({
    where: {
      createdAt: { gte: start, lte: end },
    },
    include: {
      agent: {
        select: { id: true, name: true, email: true, teamId: true, team: { select: { name: true } } },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  // Tüm aktif kullanıcıları çek (dinlenmeyen danışmanlar için)
  const allAgents = await prisma.user.findMany({
    where: { role: "AGENT" },
    select: { id: true, name: true, teamId: true, team: { select: { name: true } } },
  });

  // -- Danışman Performansı --
  const agentMap: Record<string, { name: string; calls: number; totalScore: number }> = {};
  for (const ev of evaluations) {
    const id = ev.agentId;
    if (!agentMap[id]) agentMap[id] = { name: ev.agent.name, calls: 0, totalScore: 0 };
    agentMap[id].calls++;
    agentMap[id].totalScore += ev.score;
  }
  const consultantPerformance = Object.values(agentMap)
    .map(a => ({ name: a.name, calls: a.calls, healthScore: a.calls > 0 ? Math.round((a.totalScore / a.calls) * 10) / 10 : 0 }))
    .sort((a, b) => b.calls - a.calls);

  // -- Günlük Çağrı Dağılımı --
  const dailyMap: Record<string, { firstCall: number; secondCall: number }> = {};
  for (const ev of evaluations) {
    const dateKey = new Date(ev.createdAt).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
    if (!dailyMap[dateKey]) dailyMap[dateKey] = { firstCall: 0, secondCall: 0 };
    if (ev.callType === "FIRST_CALL") dailyMap[dateKey].firstCall++;
    else dailyMap[dateKey].secondCall++;
  }
  const dailyCallBreakdown = Object.entries(dailyMap).map(([date, counts]) => ({
    date, ...counts,
  }));

  // -- Çağrı Süreleri (Danışman Bazında) --
  const durationMap: Record<string, { name: string; calls: number; totalMinutes: number }> = {};
  for (const ev of evaluations) {
    const id = ev.agentId;
    if (!durationMap[id]) durationMap[id] = { name: ev.agent.name, calls: 0, totalMinutes: 0 };
    durationMap[id].calls++;
    // Parse MM:SS format
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
    return {
      name: d.name,
      calls: d.calls,
      totalDuration: `${totalMin}:${String(totalSec).padStart(2, "0")}`,
      avgDuration: `${avgMinFloor}:${String(avgSec).padStart(2, "0")}`,
    };
  }).sort((a, b) => b.calls - a.calls);

  // -- Takım Dağılımı --
  const teamMap: Record<string, { team: string; totalCalls: number; firstCall: number; secondCall: number }> = {};
  for (const ev of evaluations) {
    const teamName = ev.agent.team?.name || "Takımsız";
    if (!teamMap[teamName]) teamMap[teamName] = { team: teamName, totalCalls: 0, firstCall: 0, secondCall: 0 };
    teamMap[teamName].totalCalls++;
    if (ev.callType === "FIRST_CALL") teamMap[teamName].firstCall++;
    else teamMap[teamName].secondCall++;
  }
  const teamDistribution = Object.values(teamMap).sort((a, b) => b.totalCalls - a.totalCalls);

  // -- Danışman Çağrı Dağılımı --
  const consultantDistMap: Record<string, { name: string; totalCalls: number; firstCall: number; secondCall: number }> = {};
  for (const ev of evaluations) {
    const id = ev.agentId;
    if (!consultantDistMap[id]) consultantDistMap[id] = { name: ev.agent.name, totalCalls: 0, firstCall: 0, secondCall: 0 };
    consultantDistMap[id].totalCalls++;
    if (ev.callType === "FIRST_CALL") consultantDistMap[id].firstCall++;
    else consultantDistMap[id].secondCall++;
  }
  const consultantCallDistribution = Object.values(consultantDistMap).sort((a, b) => b.totalCalls - a.totalCalls);

  // -- Dinlenmeyen Danışmanlar --
  const evaluatedAgentIds = new Set(evaluations.map(e => e.agentId));
  const unlistenedConsultants = allAgents
    .filter(a => !evaluatedAgentIds.has(a.id))
    .map(a => ({ name: a.name, team: a.team?.name || "Takımsız" }));

  // -- Özet İstatistikler --
  const totalEvaluations = evaluations.length;
  const totalSecondCalls = evaluations.filter(e => e.callType === "SECOND_CALL").length;
  const avgScore = totalEvaluations > 0 ? Math.round(evaluations.reduce((a, e) => a + e.score, 0) / totalEvaluations) : 0;
  const highPotential = evaluations.filter(e => e.score >= 70).length;
  const atRisk = evaluations.filter(e => e.score < 55).length;

  const reportData = {
    consultantPerformance,
    dailyCallBreakdown,
    callDurations,
    teamDistribution,
    consultantCallDistribution,
    unlistenedConsultants,
    summary: {
      totalEvaluations,
      totalSecondCalls,
      avgScore,
      highPotential,
      atRisk,
    },
  };

  const title = type === "WEEKLY"
    ? `Haftalık Rapor (${start.toLocaleDateString("tr-TR")} - ${end.toLocaleDateString("tr-TR")})`
    : `Aylık Rapor (${start.toLocaleDateString("tr-TR")} - ${end.toLocaleDateString("tr-TR")})`;

  const report = await prisma.report.create({
    data: {
      title,
      type,
      startDate: start,
      endDate: end,
      data: JSON.stringify(reportData),
    },
  });

  return NextResponse.json({ report: { ...report, data: reportData } });
}
