import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const userFindMany = vi.fn();
const queryRaw = vi.fn();
const getUserFromToken = vi.fn();
const resolveScopedAgentIds = vi.fn();

vi.mock("@/app/lib/prisma", () => ({
  default: {
    evaluation: { findMany: (...a: unknown[]) => findMany(...a) },
    user: { findMany: (...a: unknown[]) => userFindMany(...a) },
    $queryRaw: (...a: unknown[]) => queryRaw(...a),
  },
}));
// Üretilmiş client'ı mock'luyoruz: testin Prisma motoruna ihtiyacı yok, yalnızca
// Prisma.sql/Prisma.empty'nin şablon birleştirmede kullanılabilmesi gerekiyor.
vi.mock("@/app/generated/prisma", () => ({
  Prisma: {
    sql: (s: TemplateStringsArray, ...v: unknown[]) => ({ text: s.join("?"), values: v }),
    empty: { text: "", values: [] },
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

/** Bir haftalık satır. Blok TAŞIMAZ — uç bu aşamada reportData çekmiyor. */
const weekRow = (over: Record<string, unknown> = {}) => ({
  id: "e1",
  customerName: "Ali",
  callDate: new Date("2026-09-16T09:00:00.000Z"),
  score: 60,
  weakCriteria: null,
  coachingDone: false,
  agentId: "a1",
  agent: { name: "Ayşe" },
  ...over,
});

/**
 * evaluation.findMany çağrı sırası: önce puanlanamayanların id'leri (tek
 * başına, Promise.all'dan ÖNCE), sonra Promise.all içinde geçmiş ve hafta,
 * en sonda seçilenlerin blokları.
 */
const UNSCORABLE_CALL = 0;
const HISTORY_CALL = 1;
const WEEK_CALL = 2;

beforeEach(() => {
  findMany.mockReset();
  userFindMany.mockReset();
  queryRaw.mockReset();
  getUserFromToken.mockReset();
  resolveScopedAgentIds.mockReset();
  getUserFromToken.mockResolvedValue({ id: "tl1", name: "Lider", email: "l@x", role: "TEAM_LEADER" });
  resolveScopedAgentIds.mockResolvedValue({ scopedAgentIds: ["a1"] });
  findMany.mockResolvedValue([]);
  userFindMany.mockResolvedValue([{ id: "a1", name: "Ayşe" }]);
  queryRaw.mockResolvedValue([]);
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
    expect(queryRaw).not.toHaveBeenCalled();
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

  it("kapsam boşsa boş agents döner ve hiç sorgu atılmaz", async () => {
    resolveScopedAgentIds.mockResolvedValue({ scopedAgentIds: [] });
    const res = await GET(req(BASE));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.agents).toEqual([]);
    expect(findMany).not.toHaveBeenCalled();
    expect(queryRaw).not.toHaveBeenCalled();
    expect(userFindMany).not.toHaveBeenCalled();
  });

  it("danışman başına brifing kurar ve hafta bilgisini döndürür", async () => {
    findMany.mockImplementation((arg: { select?: Record<string, unknown> }) =>
      Promise.resolve(arg.select?.customerName ? [weekRow()] : []),
    );
    const res = await GET(req(`${BASE}?week=2026-W38`));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.week).toBe("2026-W38");
    expect(body.windowWeeks).toBe(4);
    expect(body.agents).toHaveLength(1);
    expect(body.agents[0].agentName).toBe("Ayşe");
    expect(body.agents[0].picks.length).toBeGreaterThan(0);
  });

  it("haftanın sorgusu reportData ÇEKMEZ — blok yalnızca seçilenler için alınır", async () => {
    // Bu ucun performans sözleşmesi. Ölçüldü: 1149 satırın reportData'sı 68 sn,
    // skalerleri 0.6 sn. Bu select'e reportData eklenirse uç tavana geri döner.
    findMany.mockImplementation((arg: { select?: Record<string, unknown> }) =>
      Promise.resolve(arg.select?.customerName ? [weekRow()] : []),
    );
    await GET(req(`${BASE}?week=2026-W38`));
    expect(findMany.mock.calls[WEEK_CALL][0].select).not.toHaveProperty("reportData");
    expect(findMany.mock.calls[HISTORY_CALL][0].select).not.toHaveProperty("reportData");
    expect(findMany.mock.calls[HISTORY_CALL][0].select).not.toHaveProperty("weakCriteria");

    // Seçim yapıldıysa blok sorgusu YALNIZCA seçilen id'lerle atılır.
    const blockCall = findMany.mock.calls[3];
    expect(blockCall[0].where.id.in).toEqual(["e1"]);
    expect(blockCall[0].select).toMatchObject({ reportData: true, weakCriteria: true });
  });

  it("her sorgu kapsanan danışmanlarla sınırlanır", async () => {
    // agentId kapsamı bu ucun YETKİ SINIRI; herhangi bir sorguda düşerse bir
    // takım lideri başka takımın verisini görür.
    resolveScopedAgentIds.mockResolvedValue({ scopedAgentIds: ["a1", "a2"] });
    await GET(req(`${BASE}?week=2026-W38`));

    expect(findMany.mock.calls[HISTORY_CALL][0].where.agentId).toEqual({ in: ["a1", "a2"] });
    expect(findMany.mock.calls[WEEK_CALL][0].where.agentId).toEqual({ in: ["a1", "a2"] });
    expect(userFindMany.mock.calls[0][0].where).toEqual({ id: { in: ["a1", "a2"] } });
    // Ham SQL'de kapsam interpolasyonla değil, parametre olarak geçer.
    expect(JSON.stringify(queryRaw.mock.calls[0])).toContain("a2");
  });

  it("geçmiş penceresi 4 hafta, hafta penceresi 1 hafta", async () => {
    await GET(req(`${BASE}?week=2026-W38`));
    const hist = findMany.mock.calls[HISTORY_CALL][0].where.callDate;
    const wk = findMany.mock.calls[WEEK_CALL][0].where.callDate;
    // gte = weekStart − 21 gün, lte = weekEnd → 28 gün − 1 ms
    expect(Math.round((hist.lte.getTime() - hist.gte.getTime()) / 86400000)).toBe(28);
    expect(Math.round((wk.lte.getTime() - wk.gte.getTime()) / 86400000)).toBe(7);
  });

  it("puanlanamayan çağrılar id ile elenir — NOT predicate NULL-güvensiz", async () => {
    // Blokların çoğunda 'scorable' anahtarı yok; NOT(reportData->'scorable' =
    // false) bu satırlarda NULL üretip onları SESSİZCE düşürüyordu. Ölçüldü:
    // 1149 satırın 686'sı kayboluyordu. Bu test o regresyonu sabitler.
    findMany.mockImplementation((arg: { select?: Record<string, unknown>; where?: Record<string, unknown> }) =>
      Promise.resolve(
        arg.where && "reportData" in arg.where ? [{ id: "junk1" }, { id: "junk2" }] : [],
      ),
    );
    await GET(req(`${BASE}?week=2026-W38`));

    // Eleme sorgusu POZİTİF yönde sorar (null-güvenli olan yön).
    expect(findMany.mock.calls[UNSCORABLE_CALL][0].where.reportData).toEqual({
      path: ["scorable"], equals: false,
    });

    // Geçmiş ve hafta sorguları id ile eler, NOT predicate KULLANMAZ.
    for (const call of [HISTORY_CALL, WEEK_CALL]) {
      const where = findMany.mock.calls[call][0].where;
      expect(where.id).toEqual({ notIn: ["junk1", "junk2"] });
      expect(where).not.toHaveProperty("NOT");
    }
  });

  it("elenecek kayıt yoksa id koşulu hiç eklenmez", async () => {
    await GET(req(`${BASE}?week=2026-W38`));
    for (const call of [HISTORY_CALL, WEEK_CALL]) {
      expect(findMany.mock.calls[call][0].where).not.toHaveProperty("id");
    }
  });

  it("kapsam null iken agentId koşulu hiç eklenmez", async () => {
    resolveScopedAgentIds.mockResolvedValue({ scopedAgentIds: null });
    await GET(req(`${BASE}?week=2026-W38`));
    expect(findMany.mock.calls[HISTORY_CALL][0].where).not.toHaveProperty("agentId");
    expect(findMany.mock.calls[WEEK_CALL][0].where).not.toHaveProperty("agentId");
  });

  it("kadroda olup hiç çağrısı olmayan danışman da listede görünür", async () => {
    resolveScopedAgentIds.mockResolvedValue({ scopedAgentIds: ["a1", "a2"] });
    userFindMany.mockResolvedValue([
      { id: "a1", name: "Ayşe" },
      { id: "a2", name: "Burak" },
    ]);
    findMany.mockImplementation((arg: { select?: Record<string, unknown> }) =>
      Promise.resolve(arg.select?.customerName ? [weekRow()] : []),
    );
    const res = await GET(req(`${BASE}?week=2026-W38`));
    const body = await res.json();
    const burak = body.agents.find((a: { agentId: string }) => a.agentId === "a2");
    expect(burak).toMatchObject({ agentName: "Burak", callCount: 0, averageScore: null, picks: [] });
  });

  it("ADMIN kapsamında kadro aktif AGENT ve TEAM_LEADER'lardan kurulur", async () => {
    resolveScopedAgentIds.mockResolvedValue({ scopedAgentIds: null });
    await GET(req(`${BASE}?week=2026-W38`));
    expect(userFindMany.mock.calls[0][0].where).toEqual({
      role: { in: ["AGENT", "TEAM_LEADER"] },
      isActive: true,
    });
  });

  it("kriter özeti SQL'den gelen sayılarla tekrar eden zayıflığı seçer", async () => {
    // occurrences bigint gelir (COUNT(*)); Number()'a çevrilmezse karşılaştırma
    // sessizce yanlış çalışır.
    queryRaw.mockResolvedValue([
      { agentId: "a1", criterionId: "C3", label: "Kapanış", occurrences: BigInt(4), avgScore: 35 },
    ]);
    findMany.mockImplementation((arg: { select?: Record<string, unknown> }) =>
      Promise.resolve(
        arg.select?.customerName
          ? [weekRow({ weakCriteria: [{ id: "C3", label: "Kapanış", score: 20 }] })]
          : [],
      ),
    );
    const res = await GET(req(`${BASE}?week=2026-W38`));
    const body = await res.json();
    const first = body.agents[0].picks[0];
    expect(first.reason).toBe("RECURRING_WEAKNESS");
    expect(first.reasonData).toMatchObject({ criterionId: "C3", occurrences: 4, windowWeeks: 4 });
  });

  it("veritabanı patlarsa 500 döner", async () => {
    findMany.mockRejectedValue(new Error("boom"));
    const res = await GET(req(BASE));
    expect(res.status).toBe(500);
  });
});
