import prisma from "@/app/lib/prisma";

export const REPORTABLE_ROLES = ["AGENT", "TEAM_LEADER"] as const;

export interface ScopeUser { id: string; role: string }

export interface ScopeResult {
  scopedAgentIds: string[] | null; // null = all consultants the viewer may see
  error?: { message: string; status: number };
}

// Resolve which agent ids a report covers, enforcing per-role access.
export async function resolveScopedAgentIds(user: ScopeUser, requestedIds: string[]): Promise<ScopeResult> {
  if (user.role === "AGENT") {
    return { scopedAgentIds: [user.id] };
  }
  if (user.role === "TEAM_LEADER") {
    const leadingTeam = await prisma.team.findUnique({ where: { leaderId: user.id }, select: { id: true } });
    if (!leadingTeam) {
      return { scopedAgentIds: null, error: { message: "Takım ataması yapılmamış.", status: 403 } };
    }
    const memberIds = (await prisma.user.findMany({ where: { teamId: leadingTeam.id }, select: { id: true } })).map(m => m.id);
    return { scopedAgentIds: requestedIds.length ? requestedIds.filter(id => memberIds.includes(id)) : memberIds };
  }
  // ADMIN / MANAGER: the selected subset, or everyone when nothing is selected.
  return { scopedAgentIds: requestedIds.length ? requestedIds : null };
}
