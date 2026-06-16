export interface MatchCandidate { id: string; customerName: string | null; agentName: string | null }
export interface MatchRow { customerName: string | null; salesOwner: string | null }

// Normalize for fuzzy comparison: strip diacritics, lowercase, drop punctuation/
// quotes (CRM exports pad names like "Sofonias' 'Biramo"), collapse whitespace.
function norm(s: string | null | undefined): string {
  return (s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function nameMatches(a: string, b: string): boolean {
  if (!a || !b) return false;
  return a === b || a.includes(b) || b.includes(a);
}

// Returns the matched evaluation id or null. Candidates MUST already be
// pre-filtered by the caller to the relevant date window.
export function matchEvaluationForRow(row: MatchRow, candidates: MatchCandidate[]): string | null {
  const cust = norm(row.customerName);
  if (!cust) return null;
  const customerMatches = candidates.filter(c => nameMatches(norm(c.customerName), cust));
  if (customerMatches.length === 0) return null;
  const owner = norm(row.salesOwner);
  if (owner) {
    const sameAgent = customerMatches.find(c => nameMatches(norm(c.agentName), owner));
    if (sameAgent) return sameAgent.id;
  }
  return customerMatches[0].id;
}
