import { describe, it, expect } from "vitest";
import { attachSelf, type MemberLite } from "./teamMembers";

const self = { id: "L1", name: "Kağan Öztürk", role: "TEAM_LEADER", email: "k@x.com" };
const members: MemberLite[] = [
  { id: "A1", name: "Ali", role: "AGENT", email: "a@x.com" },
  { id: "A2", name: "Zeynep", role: "AGENT", email: "z@x.com" },
];

describe("attachSelf", () => {
  it("returns members unchanged when includeSelf is false", () => {
    expect(attachSelf(members, self, false)).toEqual(members);
  });

  it("prepends self with isSelf flag when includeSelf is true", () => {
    const result = attachSelf(members, self, true);
    expect(result[0]).toEqual({ ...self, isSelf: true });
    expect(result.slice(1)).toEqual(members);
  });

  it("does not duplicate self if leader is already among members", () => {
    const withLeader: MemberLite[] = [
      { id: "L1", name: "Kağan Öztürk", role: "TEAM_LEADER", email: "k@x.com" },
      ...members,
    ];
    const result = attachSelf(withLeader, self, true);
    expect(result.filter((m) => m.id === "L1")).toHaveLength(1);
  });
});
