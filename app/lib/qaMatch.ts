import { normalizeAgentName } from "./agentMatch";

export interface MatchCandidate { id: string; customerName: string | null; agentName: string | null }
export interface MatchRow { customerName: string | null; salesOwner: string | null }

// Normalize for fuzzy comparison: apply the shared agent-name folding (diacritics,
// Türkçe I → i, x → ks) so CRM spelling variants match the stored names, then drop
// punctuation/quotes (CRM exports pad names like "Sofonias' 'Biramo") and collapse
// whitespace.
function norm(s: string | null | undefined): string {
  return normalizeAgentName(s ?? "")
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
//
// Both the customer name AND the consultant (salesOwner) must match. Matching on
// the customer alone attributed calls to the wrong consultant when two customers
// shared a name, so a customer-only match is intentionally left unmatched for
// manual linking rather than auto-bound to a possibly-wrong evaluation.
export function matchEvaluationForRow(row: MatchRow, candidates: MatchCandidate[]): string | null {
  const cust = norm(row.customerName);
  const owner = norm(row.salesOwner);
  if (!cust || !owner) return null;
  const match = candidates.find(
    c => nameMatches(norm(c.customerName), cust) && nameMatches(norm(c.agentName), owner)
  );
  return match ? match.id : null;
}
