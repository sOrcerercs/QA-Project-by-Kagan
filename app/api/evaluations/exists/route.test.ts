import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();

vi.mock("@/app/lib/prisma", () => ({
  default: { evaluation: { findMany: (...a: unknown[]) => findMany(...a) } },
}));

import { POST, MAX_IDS } from "./route";

function req(body: unknown, key: string | null = "gizli") {
  return {
    headers: { get: (h: string) => (h === "x-internal-key" ? key : null) },
    json: async () => {
      if (body === "BOZUK") throw new Error("bad json");
      return body;
    },
  } as never;
}

beforeEach(() => {
  findMany.mockReset();
  findMany.mockResolvedValue([]);
  process.env.INTERNAL_API_KEY = "gizli";
});

describe("POST /api/evaluations/exists", () => {
  it("INTERNAL_API_KEY yapılandırılmamışsa 500 döner — sessizce açık kalmaz", async () => {
    delete process.env.INTERNAL_API_KEY;
    const res = await POST(req({ fireflies_ids: ["a"] }));
    expect(res.status).toBe(500);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("yanlış anahtarla 401 döner ve veritabanına gitmez", async () => {
    const res = await POST(req({ fireflies_ids: ["a"] }, "yanlis"));
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("anahtar hiç yoksa 401 döner", async () => {
    const res = await POST(req({ fireflies_ids: ["a"] }, null));
    expect(res.status).toBe(401);
  });

  it("bozuk gövdede 400 döner", async () => {
    const res = await POST(req("BOZUK"));
    expect(res.status).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("boş listede sorgu atmadan boş sonuç döner", async () => {
    const res = await POST(req({ fireflies_ids: [] }));
    expect(res.status).toBe(200);
    expect((await res.json()).results).toEqual({});
    expect(findMany).not.toHaveBeenCalled();
  });

  it("tavanı aşan istekte 400 döner — sessizce kırpmaz", async () => {
    // Sessiz kırpma çağırana "bu id'ler yok" der; oysa sorulmamışlardır.
    const ids = Array.from({ length: MAX_IDS + 1 }, (_, i) => `id-${i}`);
    const res = await POST(req({ fireflies_ids: ids }));
    expect(res.status).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("tavan sınırındaki istek geçer", async () => {
    const ids = Array.from({ length: MAX_IDS }, (_, i) => `id-${i}`);
    const res = await POST(req({ fireflies_ids: ids }));
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalled();
  });
});
