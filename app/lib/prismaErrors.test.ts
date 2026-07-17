import { describe, it, expect } from "vitest";
import { isUniqueConstraintError } from "./prismaErrors";

describe("isUniqueConstraintError", () => {
  it("returns true for a Prisma P2002 known-request error", () => {
    // Mirrors PrismaClientKnownRequestError shape (duck-typed by `code`)
    const err = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["externalCallId"] },
    });
    expect(isUniqueConstraintError(err)).toBe(true);
  });

  it("scopes to a field when one is given", () => {
    const err = Object.assign(new Error("Unique constraint failed"), {
      code: "P2002",
      meta: { target: ["externalCallId"] },
    });
    expect(isUniqueConstraintError(err, "externalCallId")).toBe(true);
    expect(isUniqueConstraintError(err, "email")).toBe(false);
  });

  it("returns false for other Prisma error codes", () => {
    const err = Object.assign(new Error("Record not found"), { code: "P2025" });
    expect(isUniqueConstraintError(err)).toBe(false);
  });

  it("returns false for non-Prisma errors and non-objects", () => {
    expect(isUniqueConstraintError(new Error("boom"))).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
    expect(isUniqueConstraintError(undefined)).toBe(false);
    expect(isUniqueConstraintError("P2002")).toBe(false);
  });
});
