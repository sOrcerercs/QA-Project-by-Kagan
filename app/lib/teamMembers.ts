export interface MemberLite {
  id: string;
  name: string;
  role: string;
  email: string;
  isSelf?: boolean;
}

/**
 * Optionally prepend the requesting team leader to their own team member list.
 * The leader is not a "member" of the team they lead, so /api/team/members
 * normally omits them; views that let a leader filter their own data ask for
 * inclusion via includeSelf. Returns a new array; never duplicates the leader.
 */
export function attachSelf<T extends MemberLite>(
  members: T[],
  self: { id: string; name: string; role: string; email: string },
  includeSelf: boolean
): MemberLite[] {
  if (!includeSelf) return members;
  if (members.some((m) => m.id === self.id)) return members;
  return [{ ...self, isSelf: true }, ...members];
}
