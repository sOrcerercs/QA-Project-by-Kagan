import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const getUserFromToken = vi.fn();
const resolveScopedAgentIds = vi.fn();

vi.mock("@/app/lib/prisma", () => ({
  default: { evaluation: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
vi.mock("@/app/lib/auth", () => ({ getUserFromToken: (...a: unknown[]) => getUserFromToken(...a) }));
vi.mock("@/app/lib/reportScope", () => ({
  resolveScopedAgentIds: (...a: unknown[]) => resolveScopedAgentIds(...a),
}));

import { GET } from "./route";

function req(url: string) {
  return { nextUrl: new URL(url) } as never;
}

const BASE = "https://x.test/api/reports/coaching-briefing";

beforeEach(() => {
  findMany.mockReset();
  getUserFromToken.mockReset();
  resolveScopedAgentIds.mockReset();
  getUserFromToken.mockResolvedValue({ id: "tl1", name: "Lider", email: "l@x", role: "TEAM_LEADER" });
  resolveScopedAgentIds.mockResolvedValue({ scopedAgentIds: ["a1"] });
  findMany.mockResolvedValue([]);
});

describe("GET /api/reports/coaching-briefing", () => {
  it("oturum yoksa 401 döner", async () => {
    getUserFromToken.mockResolvedValue(null);
    const res = await GET(req(BASE));
    expect(res.status).toBe(401);
  });

  it("geçersiz week değerinde 400 döner, varsayılana düşmez", async () => {
    const res = await GET(req(`${BASE}?week=2026-38`));
    expect(res.status).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("yetki hatası scope katmanından gelirse onun durumunu yansıtır", async () => {
    resolveScopedAgentIds.mockResolvedValue({
      scopedAgentIds: null,
      error: { message: "Takım ataması yapılmamış.", status: 403 },
    });
    const res = await GET(req(BASE));
    expect(res.status).toBe(403);
  });

  it("kapsam boşsa boş agents döner", async () => {
    resolveScopedAgentIds.mockResolvedValue({ scopedAgentIds: [] });
    const res = await GET(req(BASE));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.agents).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("danışman başına brifing kurar ve hafta bilgisini döndürür", async () => {
    findMany.mockResolvedValue([
      {
        id: "e1", customerName: "Ali", callDate: new Date("2026-09-16T09:00:00.000Z"),
        score: 60, weakCriteria: null, reportData: null, coachingDone: false, agentId: "a1",
        agent: { name: "Ayşe" },
      },
    ]);
    const res = await GET(req(`${BASE}?week=2026-W38`));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.week).toBe("2026-W38");
    expect(body.windowWeeks).toBe(4);
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0].agentName).toBe("Ayşe");
    expect(body.agents[0].picks.length).toBeGreaterThan(0);
  });

  it("veritabanı patlarsa 500 döner", async () => {
    findMany.mockRejectedValue(new Error("boom"));
    const res = await GET(req(BASE));
    expect(res.status).toBe(500);
  });
});
