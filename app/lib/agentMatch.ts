export function normalizeAgentName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[ıİI]/g, "i")
    .toLowerCase()
    .replace(/x/g, "ks")
    .trim();
}

export interface AgentCandidate {
  id: string;
  name: string;
}

export type MatchTier = "exact" | "partial" | "single";

export function matchAgentName(
  name: string | null | undefined,
  candidates: AgentCandidate[],
  opts: { allowPartial?: boolean; allowSingleWord?: boolean } = {},
): { candidate: AgentCandidate; tier: MatchTier } | null {
  const { allowPartial = true, allowSingleWord = true } = opts;
  if (!name) return null;
  const norm = normalizeAgentName(name);
  if (!norm) return null;

  // exact
  for (const c of candidates) {
    if (normalizeAgentName(c.name) === norm) return { candidate: c, tier: "exact" };
  }

  const parts = norm.split(/\s+/).filter(Boolean);

  // partial (ad + soyad birlikte)
  if (allowPartial && parts.length >= 2) {
    for (const c of candidates) {
      const cNorm = normalizeAgentName(c.name);
      if (cNorm.includes(parts[0]) && cNorm.includes(parts[1])) return { candidate: c, tier: "partial" };
    }
  }

  // single (tek kelime → DB ilk-ismi)
  if (allowSingleWord && parts.length === 1) {
    for (const c of candidates) {
      const cFirst = normalizeAgentName(c.name).split(/\s+/)[0];
      if (cFirst === parts[0]) return { candidate: c, tier: "single" };
    }
  }

  return null;
}
