// Editing the Daily QA Report (upload, tick toggle, QA notes, manual evaluation
// link) is restricted to a single account. Everyone else — including MANAGERs and
// other ADMINs — has view-only access. Email-keyed at the code level, matching the
// project's existing per-email rule pattern.
export const QA_EDITOR_EMAIL = "admin@estenove.com";

export function canEditQa(email: string | null | undefined): boolean {
  return (email ?? "").trim().toLowerCase() === QA_EDITOR_EMAIL;
}
