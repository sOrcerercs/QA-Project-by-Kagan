// Danışman (AGENT) bir değerlendirmeye ancak kendi değerlendirmesiyse VE takım lideri
// coaching/feedback'ini yazdıysa (coachingDone) yanıt (kendi feedback'i) yazabilir veya
// itiraz edebilir. agent-feedback ve objection route'ları bu gate'i paylaşır.
export function canAgentRespond(
  userId: string,
  evaluation: { agentId: string; coachingDone: boolean }
): boolean {
  return evaluation.agentId === userId && evaluation.coachingDone === true;
}
