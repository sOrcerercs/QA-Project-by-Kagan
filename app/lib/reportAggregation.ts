// Pure, DB-free aggregation of one period's evaluations into the report shape
// used by the weekly report and the comparison report. Extracted from
// /api/reports/auto so both endpoints stay in sync and the logic is testable.

export interface AgentLite {
  id: string;
  name: string;
  teamId: string | null;
  team: { name: string } | null;
  role?: string;
  manager?: { name: string } | null;
}

export interface EvaluationLite {
  agentId: string;
  score: number;
  callType: string | null;
  callDuration: string;
  promptId: string | null;
  callDate: Date;
  agent: AgentLite;
}

export interface AggregationInput {
  evaluations: EvaluationLite[];
  visibleAgents: AgentLite[];
  promptNameById: Map<string, string>;
}

export interface ReportData {
  consultantPerformance: {
    agentId: string; name: string; calls: number; healthScore: number;
    byPrompt: { promptId: string; promptName: string; avgScore: number; count: number }[];
  }[];
  promptColumns: { promptId: string; promptName: string }[];
  dailyCallBreakdown: { date: string; firstCall: number; secondCall: number }[];
  callDurations: { name: string; calls: number; totalDuration: string; avgDuration: string }[];
  teamDistribution: { team: string; totalCalls: number; firstCall: number; secondCall: number }[];
  consultantCallDistribution: { name: string; totalCalls: number; firstCall: number; secondCall: number }[];
  unlistenedConsultants: { name: string; team: string }[];
  summary: { totalEvaluations: number; totalSecondCalls: number; avgScore: number; highPotential: number; atRisk: number };
}

const NONE_PROMPT = "__none__";
const NONE_PROMPT_LABEL = "Belirtilmedi";

const teamNameFor = (a: AgentLite): string =>
  a.team?.name ||
  (a.role === "TEAM_LEADER" && a.manager?.name ? `${a.manager.name}'in Takımı` : "Takimsiz");

export function aggregateReport({ evaluations, visibleAgents, promptNameById }: AggregationInput): ReportData {
  const promptColMap = new Map<string, string>();
  const perfMap: Record<string, { name: string; calls: number; totalScore: number; byPrompt: Record<string, { sum: number; count: number }> }> = {};
  for (const ev of evaluations) {
    const id = ev.agentId;
    if (!perfMap[id]) perfMap[id] = { name: ev.agent.name, calls: 0, totalScore: 0, byPrompt: {} };
    perfMap[id].calls++;
    perfMap[id].totalScore += ev.score;
    const pid = ev.promptId ?? NONE_PROMPT;
    const pname = ev.promptId ? (promptNameById.get(ev.promptId) ?? ev.promptId) : NONE_PROMPT_LABEL;
    promptColMap.set(pid, pname);
    if (!perfMap[id].byPrompt[pid]) perfMap[id].byPrompt[pid] = { sum: 0, count: 0 };
    perfMap[id].byPrompt[pid].sum += ev.score;
    perfMap[id].byPrompt[pid].count++;
  }
  const promptColumns = [...promptColMap.entries()]
    .map(([promptId, promptName]) => ({ promptId, promptName }))
    .sort((a, b) => (a.promptId === NONE_PROMPT ? 1 : b.promptId === NONE_PROMPT ? -1 : a.promptName.localeCompare(b.promptName)));
  const consultantPerformance = Object.entries(perfMap)
    .map(([agentId, a]) => ({
      agentId, name: a.name, calls: a.calls,
      healthScore: a.calls > 0 ? Math.round((a.totalScore / a.calls) * 10) / 10 : 0,
      byPrompt: Object.entries(a.byPrompt).map(([promptId, v]) => ({
        promptId, promptName: promptColMap.get(promptId)!,
        avgScore: Math.round((v.sum / v.count) * 10) / 10, count: v.count,
      })),
    }))
    .sort((a, b) => b.calls - a.calls);

  const dailyMap: Record<string, { firstCall: number; secondCall: number }> = {};
  for (const ev of evaluations) {
    const dateKey = new Date(ev.callDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long" });
    if (!dailyMap[dateKey]) dailyMap[dateKey] = { firstCall: 0, secondCall: 0 };
    if (ev.callType === "FIRST_CALL") dailyMap[dateKey].firstCall++;
    else dailyMap[dateKey].secondCall++;
  }
  const dailyCallBreakdown = Object.entries(dailyMap).map(([date, counts]) => ({ date, ...counts }));

  const durationMap: Record<string, { name: string; calls: number; totalMinutes: number }> = {};
  for (const ev of evaluations) {
    const id = ev.agentId;
    if (!durationMap[id]) durationMap[id] = { name: ev.agent.name, calls: 0, totalMinutes: 0 };
    durationMap[id].calls++;
    const parts = ev.callDuration.split(":");
    if (parts.length === 2) durationMap[id].totalMinutes += parseInt(parts[0]) + parseInt(parts[1]) / 60;
  }
  const callDurations = Object.values(durationMap).map(d => {
    const totalMin = Math.floor(d.totalMinutes);
    const totalSec = Math.round((d.totalMinutes - totalMin) * 60);
    const avgMin = d.calls > 0 ? d.totalMinutes / d.calls : 0;
    const avgMinFloor = Math.floor(avgMin);
    const avgSec = Math.round((avgMin - avgMinFloor) * 60);
    return { name: d.name, calls: d.calls, totalDuration: `${totalMin}:${String(totalSec).padStart(2, "0")}`, avgDuration: `${avgMinFloor}:${String(avgSec).padStart(2, "0")}` };
  }).sort((a, b) => b.calls - a.calls);

  const teamMap: Record<string, { team: string; totalCalls: number; firstCall: number; secondCall: number }> = {};
  for (const ev of evaluations) {
    const teamName = teamNameFor(ev.agent);
    if (!teamMap[teamName]) teamMap[teamName] = { team: teamName, totalCalls: 0, firstCall: 0, secondCall: 0 };
    teamMap[teamName].totalCalls++;
    if (ev.callType === "FIRST_CALL") teamMap[teamName].firstCall++;
    else teamMap[teamName].secondCall++;
  }
  const teamDistribution = Object.values(teamMap).sort((a, b) => b.totalCalls - a.totalCalls);

  const cdMap: Record<string, { name: string; totalCalls: number; firstCall: number; secondCall: number }> = {};
  for (const ev of evaluations) {
    const id = ev.agentId;
    if (!cdMap[id]) cdMap[id] = { name: ev.agent.name, totalCalls: 0, firstCall: 0, secondCall: 0 };
    cdMap[id].totalCalls++;
    if (ev.callType === "FIRST_CALL") cdMap[id].firstCall++;
    else cdMap[id].secondCall++;
  }
  const consultantCallDistribution = Object.values(cdMap).sort((a, b) => b.totalCalls - a.totalCalls);

  const evaluatedAgentIds = new Set(evaluations.map(e => e.agentId));
  const unlistenedConsultants = visibleAgents
    .filter(a => !evaluatedAgentIds.has(a.id))
    .map(a => ({ name: a.name, team: a.team?.name || "Takimsiz" }));

  const totalEvaluations = evaluations.length;
  const totalSecondCalls = evaluations.filter(e => e.callType === "SECOND_CALL" || !e.callType).length;
  const avgScore = totalEvaluations > 0 ? Math.round(evaluations.reduce((a, e) => a + e.score, 0) / totalEvaluations) : 0;
  const highPotential = evaluations.filter(e => e.score >= 70).length;
  const atRisk = evaluations.filter(e => e.score < 55).length;

  return {
    consultantPerformance, promptColumns, dailyCallBreakdown, callDurations,
    teamDistribution, consultantCallDistribution, unlistenedConsultants,
    summary: { totalEvaluations, totalSecondCalls, avgScore, highPotential, atRisk },
  };
}
