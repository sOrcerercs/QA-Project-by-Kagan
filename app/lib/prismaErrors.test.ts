import { describe, it, expect } from "vitest";
import { isDuplicateCallError, isUniqueConstraintOn } from "./prismaErrors";

/** Prisma 7 + PrismaPg adaptöründen gelen GERÇEK hata şekli (canlı DB'de yakalandı). */
const prisma7 = {
  code: "P2002",
  message:
    "\nInvalid `prisma.evaluation.create()` invocation:\n\n\nUnique constraint failed on the fields: (`\"externalCallId\"`)",
  meta: {
    modelName: "Evaluation",
    driverAdapterError: {
      name: "DriverAdapterError",
      cause: {
        originalCode: "23505",
        originalMessage: 'duplicate key value violates unique constraint "Evaluation_externalCallId_key"',
        kind: "UniqueConstraintViolation",
        constraint: { fields: ['"externalCallId"'] },
      },
    },
  },
};

/** Eski Prisma sürümlerinin şekli — geriye uyum. */
const prismaEski = { code: "P2002", meta: { target: ["externalCallId"] } };

describe("isDuplicateCallError", () => {
  it("Prisma 7 sürücü adaptörü şeklini tanır", () => {
    expect(isDuplicateCallError(prisma7)).toBe(true);
  });

  it("eski meta.target şeklini de tanır", () => {
    expect(isDuplicateCallError(prismaEski)).toBe(true);
  });

  it("başka bir alanın kısıt ihlalini bu sayMAZ", () => {
    expect(isDuplicateCallError({ code: "P2002", meta: { target: ["email"] } })).toBe(false);
  });

  it("P2002 olmayan hatayı sayMAZ", () => {
    expect(isDuplicateCallError({ code: "P2025", meta: { target: ["externalCallId"] } })).toBe(false);
  });

  it("düz Error'da patlamaz", () => {
    expect(isDuplicateCallError(new Error("boom"))).toBe(false);
    expect(isDuplicateCallError(null)).toBe(false);
    expect(isDuplicateCallError(undefined)).toBe(false);
  });

  it("serileştirilemeyen meta'da patlamaz", () => {
    const donguSel: Record<string, unknown> = { code: "P2002" };
    donguSel.meta = donguSel;   // JSON.stringify burada hata fırlatır
    expect(() => isDuplicateCallError(donguSel)).not.toThrow();
  });
});

describe("isUniqueConstraintOn", () => {
  it("istenen alanı arar", () => {
    expect(isUniqueConstraintOn(prismaEski, "externalCallId")).toBe(true);
    expect(isUniqueConstraintOn(prismaEski, "email")).toBe(false);
  });
});
