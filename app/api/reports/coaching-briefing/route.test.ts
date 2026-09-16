import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const userFindMany = vi.fn();
const getUserFromToken = vi.fn();
const resolveScopedAgentIds = vi.fn();

vi.mock("@/app/lib/prisma", () => ({
  default: {
    evaluation: { findMany: (...a: unknown[]) => findMany(...a) },
    user: { findMany: (...a: unknown[]) => userFindMany(...a) },
  },
}));
vi.mock("@/app/lib/auth", () => ({ getUserFromToken: (...a: unknown[]) => getUserFromToken(...a) }));
vi.mock("@/app/lib/reportScope", () => ({
  REPORTABLE_ROLES: ["AGENT", "TEAM_LEADER"],
  resolveScopedAgentIds: (...a: unknown[]) => resolveScopedAgentIds(...a),
}));

import { GET } from "./route";

function req(url: string) {
  return { nextUrl: new URL(url) } as never;
}

const BASE = "https://x.test/api/reports/coaching-briefing";

beforeEach(() => {
  findMany.mockReset();
  userFindMany.mockReset();
  getUserFromToken.mockReset();
  resolveScopedAgentIds.mockReset();
  getUserFromToken.mockResolvedValue({ id: "tl1", name: "Lider", email: "l@x", role: "TEAM_LEADER" });
  resolveScopedAgentIds.mockResolvedValue({ scopedAgentIds: ["a1"] });
  findMany.mockResolvedValue([]);
  userFindMany.mockResolvedValue([{ id: "a1", name: "Ayşe" }]);
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

  it("geçersiz lang değerinde 400 döner, varsayılana düşmez", async () => {
    const res = await GET(req(`${BASE}?lang=de`));
    expect(res.status).toBe(400);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("lang verilmezse tr varsayılır ve sorgu çalışır", async () => {
    const res = await GET(req(BASE));
    expect(res.status).toBe(200);
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

  it("sorguyu kapsanan danışmanlarla ve 4 haftalık pencereyle sınırlar", async () => {
    // agentId: { in: scopedAgentIds } bu ucun YETKİ SINIRI; o spread'i düşüren
    // bir refactor her takım liderine her takımın verisini açardı.
    resolveScopedAgentIds.mockResolvedValue({ scopedAgentIds: ["a1", "a2"] });
    await GET(req(`${BASE}?week=2026-W38`));
    const arg = findMany.mock.calls[0][0];
    expect(arg.where.agentId).toEqual({ in: ["a1", "a2"] });
    expect(arg.where.unassigned).toBe(false);

    // Pencere aritmetiği, elle türetme:
    //   gte = weekStart − (WINDOW_WEEKS − 1) × 7 gün = weekStart − 21 gün
    //   lte = weekEnd  = weekStart + 7 gün − 1 ms
    //   fark = 28 gün − 1 ms → güne yuvarlanınca 28
    const { gte, lte } = arg.where.callDate;
    expect(Math.round((lte.getTime() - gte.getTime()) / 86400000)).toBe(28);
  });

  it("kapsam null iken agentId koşulu hiç eklenmez", async () => {
    resolveScopedAgentIds.mockResolvedValue({ scopedAgentIds: null });
    await GET(req(`${BASE}?week=2026-W38`));
    expect(findMany.mock.calls[0][0].where).not.toHaveProperty("agentId");
  });

  it("kadroda olup hiç çağrısı olmayan danışman da listede görünür", async () => {
    resolveScopedAgentIds.mockResolvedValue({ scopedAgentIds: ["a1", "a2"] });
    userFindMany.mockResolvedValue([
      { id: "a1", name: "Ayşe" },
      { id: "a2", name: "Burak" },
    ]);
    findMany.mockResolvedValue([
      {
        id: "e1", customerName: "Ali", callDate: new Date("2026-09-16T09:00:00.000Z"),
        score: 60, weakCriteria: null, reportData: null, coachingDone: false, agentId: "a1",
        agent: { name: "Ayşe" },
      },
    ]);
    const res = await GET(req(`${BASE}?week=2026-W38`));
    const body = await res.json();
    const burak = body.agents.find((a: { agentId: string }) => a.agentId === "a2");
    expect(burak).toMatchObject({ agentName: "Burak", callCount: 0, averageScore: null, picks: [] });
  });

  it("kadro sorgusu kapsam dışına çıkmaz", async () => {
    resolveScopedAgentIds.mockResolvedValue({ scopedAgentIds: ["a1", "a2"] });
    await GET(req(`${BASE}?week=2026-W38`));
    expect(userFindMany.mock.calls[0][0].where).toEqual({ id: { in: ["a1", "a2"] } });
  });

  it("ADMIN kapsamında kadro aktif AGENT ve TEAM_LEADER'lardan kurulur", async () => {
    resolveScopedAgentIds.mockResolvedValue({ scopedAgentIds: null });
    await GET(req(`${BASE}?week=2026-W38`));
    expect(userFindMany.mock.calls[0][0].where).toEqual({
      role: { in: ["AGENT", "TEAM_LEADER"] },
      isActive: true,
    });
  });

  it("veritabanı patlarsa 500 döner", async () => {
    findMany.mockRejectedValue(new Error("boom"));
    const res = await GET(req(BASE));
    expect(res.status).toBe(500);
  });
});
