export const KNOWN_ISSUE_STATUSES = ["INVESTIGATING", "IN_PROGRESS", "RESOLVED"] as const;
export type KnownIssueStatus = (typeof KNOWN_ISSUE_STATUSES)[number];

const TITLE_MAX = 200;
const DESCRIPTION_MAX = 4000;

export function isValidStatus(s: unknown): s is KnownIssueStatus {
  return typeof s === "string" && (KNOWN_ISSUE_STATUSES as readonly string[]).includes(s);
}

export function validateIssueInput(input: {
  title?: unknown;
  description?: unknown;
  status?: unknown;
}):
  | { ok: true; value: { title: string; description: string; status: KnownIssueStatus } }
  | { ok: false; error: string } {
  const title = typeof input.title === "string" ? input.title.trim() : "";
  if (!title) return { ok: false, error: "Başlık zorunludur." };
  if (title.length > TITLE_MAX) return { ok: false, error: `Başlık en fazla ${TITLE_MAX} karakter olabilir.` };

  const description = typeof input.description === "string" ? input.description.trim() : "";
  if (description.length > DESCRIPTION_MAX)
    return { ok: false, error: `Açıklama en fazla ${DESCRIPTION_MAX} karakter olabilir.` };

  let status: KnownIssueStatus = "INVESTIGATING";
  if (input.status !== undefined && input.status !== null && input.status !== "") {
    if (!isValidStatus(input.status)) return { ok: false, error: "Geçersiz durum." };
    status = input.status;
  }

  return { ok: true, value: { title, description, status } };
}

export function sortKnownIssues<T extends { status: string; createdAt: string | Date }>(issues: T[]): T[] {
  const rank = (s: string) => (s === "RESOLVED" ? 1 : 0);
  const time = (d: string | Date) => new Date(d).getTime();
  return [...issues].sort((a, b) => {
    const r = rank(a.status) - rank(b.status);
    if (r !== 0) return r;
    return time(b.createdAt) - time(a.createdAt);
  });
}
