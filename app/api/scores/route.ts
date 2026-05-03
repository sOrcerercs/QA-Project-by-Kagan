import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const agentId = req.nextUrl.searchParams.get("agentId") || user.id;

  const startDate = req.nextUrl.searchParams.get("startDate");
  const endDate = req.nextUrl.searchParams.get("endDate");

  const isValidDate = (s: string) => !isNaN(Date.parse(s));
  if (startDate && !isValidDate(startDate)) {
    return NextResponse.json({ error: "Geçersiz startDate." }, { status: 400 });
  }
  if (endDate && !isValidDate(endDate)) {
    return NextResponse.json({ error: "Geçersiz endDate." }, { status: 400 });
  }

  const dateFilter = startDate || endDate ? {
    createdAt: {
      ...(startDate && { gte: new Date(startDate) }),
      ...(endDate && { lte: new Date(endDate + "T23:59:59.999Z") }),
    },
  } : {};

  // Rol kontrolü: AGENT sadece kendini görebilir
  if (user.role === "AGENT" && agentId !== user.id) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  // TEAM_LEADER sadece kendi takımını görebilir
  if (user.role === "TEAM_LEADER" && agentId !== user.id) {
    const leadingTeam = await prisma.team.findUnique({
      where: { leaderId: user.id },
      select: { id: true },
    });
    const targetUser = await prisma.user.findUnique({ where: { id: agentId }, select: { teamId: true } });
    if (!leadingTeam || targetUser?.teamId !== leadingTeam.id) {
      return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
    }
  }

  // Agent bilgisi
  const agent = await prisma.user.findUnique({
    where: { id: agentId },
    select: { id: true, name: true, role: true, team: { select: { name: true } } },
  });

  if (!agent) return NextResponse.json({ error: "Danışman bulunamadı." }, { status: 404 });

  // Evaluations
  const evaluations = await prisma.evaluation.findMany({
    where: { agentId, ...dateFilter },
    orderBy: { createdAt: "desc" },
  });

  // Tüm agentlar (ranking için)
  const allAgents = await prisma.user.findMany({
    where: { role: "AGENT" },
    select: { id: true, name: true },
  });

  // Her agent için avg score
  const agentScores: { id: string; name: string; avgScore: number }[] = [];
  for (const a of allAgents) {
    const evals = await prisma.evaluation.findMany({
      where: { agentId: a.id },
      select: { score: true },
    });
    const avg = evals.length > 0 ? Math.round(evals.reduce((s, e) => s + e.score, 0) / evals.length) : 0;
    agentScores.push({ id: a.id, name: a.name, avgScore: avg });
  }
  agentScores.sort((a, b) => b.avgScore - a.avgScore);
  const rank = agentScores.findIndex(a => a.id === agentId) + 1;

  // Özet
  const totalCalls = evaluations.length;
  const avgScore = totalCalls > 0 ? Math.round(evaluations.reduce((s, e) => s + e.score, 0) / totalCalls) : 0;
  const highestScore = totalCalls > 0 ? Math.max(...evaluations.map(e => e.score)) : 0;

  // Haftalık progress (son 4 hafta)
  const now = new Date();
  const weeklyProgress = [];
  for (let w = 3; w >= 0; w--) {
    const weekStart = new Date(now);
    weekStart.setDate(weekStart.getDate() - (w * 7 + now.getDay()));
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 7);

    const weekEvals = evaluations.filter(e => {
      const d = new Date(e.createdAt);
      return d >= weekStart && d < weekEnd;
    });
    const weekAvg = weekEvals.length > 0 ? Math.round(weekEvals.reduce((s, e) => s + e.score, 0) / weekEvals.length) : 0;
    weeklyProgress.push({
      week: `Hafta ${4 - w}`,
      score: weekAvg,
      calls: weekEvals.length,
    });
  }

  // Son çağrılar
  const recentCalls = evaluations.slice(0, 5).map(e => ({
    id: e.id,
    date: new Date(e.createdAt).toLocaleDateString("tr-TR"),
    customer: e.customerName,
    score: e.score,
    callType: e.callType,
    duration: e.callDuration,
  }));

  // Gercek veri varsa dondur
  if (totalCalls > 0) {
    return NextResponse.json({
      agent: { id: agent.id, name: agent.name, role: agent.role, team: agent.team?.name || "Takimsiz" },
      rank, totalAgents: allAgents.length,
      stats: { totalCalls, avgScore, highestScore },
      weeklyProgress, recentCalls, isDemo: false,
    });
  }

  // Demo veri — gercek evaluation yokken ornek gosterim
  const demoScores: Record<string, { avg: number; highest: number; calls: number; rank: number }> = {
    "Mehmet Akgul": { avg: 88, highest: 96, calls: 12, rank: 1 },
    "Damla Turkay": { avg: 82, highest: 91, calls: 10, rank: 2 },
    "Ibrahim Sik": { avg: 79, highest: 88, calls: 9, rank: 3 },
    "Alexandra Boyko": { avg: 76, highest: 85, calls: 8, rank: 4 },
    "Soufiane Slimane": { avg: 74, highest: 84, calls: 8, rank: 5 },
    "Guney Goc": { avg: 85, highest: 94, calls: 7, rank: 2 },
    "Miray Ipek": { avg: 71, highest: 82, calls: 7, rank: 6 },
    "Melike Alara Bulut": { avg: 68, highest: 78, calls: 6, rank: 7 },
    "Nurhan Guney": { avg: 66, highest: 75, calls: 6, rank: 8 },
    "Mavican Tekuz": { avg: 63, highest: 72, calls: 5, rank: 9 },
    "Furkan Kirik": { avg: 61, highest: 70, calls: 4, rank: 10 },
    "Sinem Bulur": { avg: 75, highest: 82, calls: 3, rank: 5 },
    "Didem Ozbek": { avg: 52, highest: 65, calls: 3, rank: 12 },
    "Deniz Senavci": { avg: 72, highest: 80, calls: 2, rank: 6 },
    "Emir Ozdemir": { avg: 45, highest: 58, calls: 2, rank: 15 },
  };

  // Isme gore demo veri bul veya varsayilan uret
  const agentNameNorm = agent.name.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const demoMatch = Object.entries(demoScores).find(([key]) =>
    agentNameNorm.toLowerCase().includes(key.split(" ")[0].toLowerCase())
  );

  const demo = demoMatch
    ? demoMatch[1]
    : { avg: 65 + Math.floor(Math.random() * 20), highest: 75 + Math.floor(Math.random() * 15), calls: 3 + Math.floor(Math.random() * 8), rank: Math.floor(Math.random() * 15) + 1 };

  const demoTotalAgents = Math.max(allAgents.length, 15);

  const demoWeeklyProgress = [
    { week: "Hafta 1", score: Math.max(demo.avg - 8, 30), calls: Math.ceil(demo.calls * 0.2) },
    { week: "Hafta 2", score: Math.max(demo.avg - 4, 35), calls: Math.ceil(demo.calls * 0.25) },
    { week: "Hafta 3", score: demo.avg - 1, calls: Math.ceil(demo.calls * 0.25) },
    { week: "Hafta 4", score: demo.avg, calls: Math.ceil(demo.calls * 0.3) },
  ];

  const customerNames = ["John Smith", "Maria Garcia", "Ahmed Hassan", "Sophie Mueller", "Carlos Mendez", "Yuki Tanaka", "Liam O'Brien"];
  const callTypes = ["SECOND_CALL", "SECOND_CALL", "FIRST_CALL", "SECOND_CALL", "FOLLOW_UP"];
  const demoRecentCalls = Array.from({ length: Math.min(demo.calls, 5) }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - i - 1);
    const score = demo.avg + Math.floor((Math.random() - 0.5) * 16);
    return {
      id: `demo-${i}`,
      date: d.toLocaleDateString("tr-TR"),
      customer: customerNames[i % customerNames.length],
      score: Math.min(Math.max(score, 20), 100),
      callType: callTypes[i % callTypes.length],
      duration: `${8 + Math.floor(Math.random() * 18)}:${String(Math.floor(Math.random() * 60)).padStart(2, "0")}`,
    };
  });

  return NextResponse.json({
    agent: { id: agent.id, name: agent.name, role: agent.role, team: agent.team?.name || "Takimsiz" },
    rank: demo.rank, totalAgents: demoTotalAgents,
    stats: { totalCalls: demo.calls, avgScore: demo.avg, highestScore: demo.highest },
    weeklyProgress: demoWeeklyProgress, recentCalls: demoRecentCalls, isDemo: true,
  });
}
