// Analiz bölümünün çağrı havuzunu yükler. Sohbet (/api/analysis/chat) ve tarama
// (/api/analysis/scan) route'ları aynı havuzu kullanır — filtre mantığı tek yerde
// dursun diye buraya alındı.
import prisma from "@/app/lib/prisma";
import { REPORTABLE_ROLES } from "@/app/lib/reportScope";
import type { AnalysisCall } from "@/app/lib/analysisRetrieval";

// app/api/okr/route.ts içindeki UNASSIGNED_AGENT_EMAIL ile aynı olmalı.
const UNASSIGNED_AGENT_EMAIL = "unassigned@estenove.local";

export interface AnalysisPool {
  calls: AnalysisCall[];
  /** Seçilmiş ama bu aralıkta hiç çağrısı olmayan danışmanlar. */
  missingAgents: string[];
  /** Rolü AGENT/TEAM_LEADER olmadığı için havuza girmeyen değerlendirme sayısı. */
  excludedByRole: number;
}

export async function loadAnalysisPool(opts: {
  start: Date;
  endExclusive: Date;
  agentIds: string[];
}): Promise<AnalysisPool> {
  const { start, endExclusive, agentIds } = opts;
  const agentFilter = agentIds.length ? { agentId: { in: agentIds } } : {};

  const rows = await prisma.evaluation.findMany({
    where: {
      callDate: { gte: start, lte: endExclusive },
      ...agentFilter,
      agent: {
        role: { in: [...REPORTABLE_ROLES] },
        email: { not: UNASSIGNED_AGENT_EMAIL },
      },
    },
    select: {
      id: true,
      agentId: true,
      callDate: true,
      callType: true,
      score: true,
      customerName: true,
      transcript: true,
      report: true,
      agent: { select: { name: true } },
    },
    orderBy: { callDate: "desc" },
  });

  const calls: AnalysisCall[] = rows.map((r) => ({
    id: r.id,
    agentId: r.agentId,
    agentName: r.agent?.name ?? "—",
    customerName: r.customerName ?? "—",
    callDate: r.callDate,
    callType: String(r.callType),
    score: r.score,
    transcript: r.transcript ?? "",
    report: r.report ?? "",
  }));

  // Sessiz eksik uyarıları: ikisi de söylenmezse cevap eksik veriden üretilmiş olur.
  const presentAgentIds = new Set(calls.map((c) => c.agentId));
  const missingIds = agentIds.filter((id) => !presentAgentIds.has(id));
  const missingAgents = missingIds.length
    ? (
        await prisma.user.findMany({
          where: { id: { in: missingIds } },
          select: { name: true },
          orderBy: { name: "asc" },
        })
      ).map((u) => u.name)
    : [];

  const excludedByRole = await prisma.evaluation.count({
    where: {
      callDate: { gte: start, lte: endExclusive },
      ...agentFilter,
      agent: { role: { notIn: [...REPORTABLE_ROLES] } },
    },
  });

  return { calls, missingAgents, excludedByRole };
}
