export interface WeakCriterion {
  id: string;
  label: string;
  score: number;
  coachingNote?: string;
  section?: string;
}

export interface EvaluationForCriterion {
  id: string;
  customerName: string;
  callDate: Date | string;
  score: number;
  weakCriteria: unknown;
}

export interface CriterionOccurrence {
  evaluationId: string;
  customerName: string;
  callDate: string;
  score: number;
  criterionScore: number;
}

export function extractCriterionOccurrences(
  evaluations: EvaluationForCriterion[],
  criterionId: string,
): CriterionOccurrence[] {
  const out: CriterionOccurrence[] = [];
  for (const e of evaluations) {
    if (!Array.isArray(e.weakCriteria)) continue;
    const match = (e.weakCriteria as WeakCriterion[]).find((c) => c.id === criterionId);
    if (!match) continue;
    out.push({
      evaluationId: e.id,
      customerName: e.customerName,
      callDate: new Date(e.callDate).toISOString(),
      score: e.score,
      criterionScore: match.score,
    });
  }
  return out;
}
