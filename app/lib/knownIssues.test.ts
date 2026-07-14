import { describe, it, expect } from "vitest";
import {
  KNOWN_ISSUE_STATUSES,
  isValidStatus,
  validateIssueInput,
  sortKnownIssues,
} from "./knownIssues";

describe("isValidStatus", () => {
  it("accepts the three known statuses", () => {
    for (const s of KNOWN_ISSUE_STATUSES) expect(isValidStatus(s)).toBe(true);
  });
  it("rejects unknown values", () => {
    expect(isValidStatus("OPEN")).toBe(false);
    expect(isValidStatus("")).toBe(false);
    expect(isValidStatus(123)).toBe(false);
    expect(isValidStatus(null)).toBe(false);
  });
});

describe("validateIssueInput", () => {
  it("accepts a valid input and trims title/description", () => {
    const r = validateIssueInput({ title: "  Sync gecikmesi  ", description: "  detay  ", status: "IN_PROGRESS" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.title).toBe("Sync gecikmesi");
      expect(r.value.description).toBe("detay");
      expect(r.value.status).toBe("IN_PROGRESS");
    }
  });
  it("defaults status to INVESTIGATING and description to empty when omitted", () => {
    const r = validateIssueInput({ title: "Başlık" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.status).toBe("INVESTIGATING");
      expect(r.value.description).toBe("");
    }
  });
  it("rejects empty/whitespace title", () => {
    expect(validateIssueInput({ title: "   " }).ok).toBe(false);
    expect(validateIssueInput({}).ok).toBe(false);
  });
  it("rejects a title longer than 200 chars", () => {
    expect(validateIssueInput({ title: "x".repeat(201) }).ok).toBe(false);
  });
  it("rejects a description longer than 4000 chars", () => {
    expect(validateIssueInput({ title: "ok", description: "x".repeat(4001) }).ok).toBe(false);
  });
  it("rejects an invalid status", () => {
    expect(validateIssueInput({ title: "ok", status: "DONE" }).ok).toBe(false);
  });
});

describe("sortKnownIssues", () => {
  it("puts active issues before resolved, newest first within each group", () => {
    const input = [
      { id: "a", status: "RESOLVED", createdAt: "2026-01-01T00:00:00Z" },
      { id: "b", status: "INVESTIGATING", createdAt: "2026-02-01T00:00:00Z" },
      { id: "c", status: "RESOLVED", createdAt: "2026-03-01T00:00:00Z" },
      { id: "d", status: "IN_PROGRESS", createdAt: "2026-04-01T00:00:00Z" },
    ];
    const out = sortKnownIssues(input);
    expect(out.map(i => i.id)).toEqual(["d", "b", "c", "a"]);
  });
  it("does not mutate the input array", () => {
    const input = [{ id: "x", status: "RESOLVED", createdAt: "2026-01-01T00:00:00Z" }];
    const copy = [...input];
    sortKnownIssues(input);
    expect(input).toEqual(copy);
  });
});
