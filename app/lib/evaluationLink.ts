// Extract an evaluation id from whatever a user pastes: a full URL
// (https://app/evaluation/<id>), a relative path (/evaluation/<id>), or the bare
// id. Query string, hash, and trailing slash are stripped. Returns null if nothing
// usable remains. Existence is validated separately against the database.
export function parseEvaluationId(input: string): string | null {
  let s = (input ?? "").trim();
  if (!s) return null;
  const marker = "/evaluation/";
  const idx = s.indexOf(marker);
  if (idx !== -1) s = s.slice(idx + marker.length);
  s = s.split(/[/?#]/)[0].trim();
  return s || null;
}
