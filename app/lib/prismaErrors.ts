/**
 * Detect a Prisma "unique constraint failed" error (code P2002).
 *
 * The check-then-create dedup pattern in the sync routes is not atomic: two
 * concurrent syncs can both pass `findUnique` and then both `create`, so the
 * loser hits the DB unique index on `externalCallId`. Callers use this to treat
 * that collision as "already imported" instead of crashing the whole sync.
 *
 * Duck-typed on `code` rather than `instanceof PrismaClientKnownRequestError` so
 * it stays robust across the driver-adapter runtime boundary.
 */
export function isUniqueConstraintError(error: unknown, field?: string): boolean {
  if (typeof error !== "object" || error === null) return false;
  const e = error as { code?: unknown; meta?: { target?: unknown } };
  if (e.code !== "P2002") return false;
  if (!field) return true;

  const target = e.meta?.target;
  if (Array.isArray(target)) return target.includes(field);
  if (typeof target === "string") return target.includes(field);
  return false;
}
