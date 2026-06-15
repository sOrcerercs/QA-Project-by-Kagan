import prisma from "@/app/lib/prisma";

// Team leader whose team's calls (and her own) are always evaluated with the
// First Call prompt, bypassing auto call-type detection. Keyed by email so a
// name change/typo cannot silently disable the rule.
export const FORCED_FIRST_CALL_LEADER_EMAIL = "sumeyrademir@estenove.com";

// Pure: does this email equal the configured leader email (trimmed, case-insensitive)?
export function matchesForcedFirstCallEmail(email: string | null | undefined): boolean {
  return !!email && email.trim().toLowerCase() === FORCED_FIRST_CALL_LEADER_EMAIL;
}

// True when the agent is a member of the forced-first-call team (its leader is
// the configured email) or is that leader herself. Returns false for no agent.
export async function shouldForceFirstCall(agentId: string | null | undefined): Promise<boolean> {
  if (!agentId) return false;
  const u = await prisma.user.findUnique({
    where: { id: agentId },
    select: { email: true, team: { select: { leader: { select: { email: true } } } } },
  });
  if (!u) return false;
  return matchesForcedFirstCallEmail(u.email) || matchesForcedFirstCallEmail(u.team?.leader?.email);
}
