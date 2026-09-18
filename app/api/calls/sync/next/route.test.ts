import { describe, it, expect, vi, beforeEach } from "vitest";

const findMany = vi.fn();
const getUserFromToken = vi.fn();
const fetchCallsByDate = vi.fn();
const processCall = vi.fn();
const getOrCreateUnassignedUser = vi.fn();

vi.mock("@/app/lib/prisma", () => ({
  default: { evaluation: { findMany: (...a: unknown[]) => findMany(...a) } },
}));
vi.mock("@/app/lib/auth", () => ({ getUserFromToken: (...a: unknown[]) => getUserFromToken(...a) }));
vi.mock("@/app/lib/kriko", () => ({
  fetchCallsByDate: (...a: unknown[]) => fetchCallsByDate(...a),
  // Gerçek filtre 120 sn altını eler; testte süreye göre eliyoruz ki
  // "analiz edilebilir" kavramı testte de anlamlı kalsın.
  filterAnalyzableCalls: (calls: Array<{ duration_seconds: number }>, min: number) =>
    calls.filter((c) => c.duration_seconds >= min),
  yesterdayInTR: () => "2026-09-16",
  isKrikoConfigured: () => true,
}));
vi.mock("@/app/lib/krikoSync", () => ({
  processCall: (...a: unknown[]) => processCall(...a),
  getOrCreateUnassignedUser: (...a: unknown[]) => getOrCreateUnassignedUser(...a),
}));

import { POST } from "./route";

const call = (id: string, duration_seconds = 300) => ({ id, duration_seconds, agent_name: "Ayşe" });

function req(body: unknown) {
  return {
    headers: { get: () => "localhost:3000" },
    json: async () => {
      if (body === "BOZUK") throw new Error("bad json");
      return body;
    },
  } as never;
}

beforeEach(() => {
  findMany.mockReset();
  getUserFromToken.mockReset();
  fetchCallsByDate.mockReset();
  processCall.mockReset();
  getOrCreateUnassignedUser.mockReset();

  getUserFromToken.mockResolvedValue({ id: "a1", role: "ADMIN" });
  getOrCreateUnassignedUser.mockResolvedValue({ id: "unassigned" });
  findMany.mockResolvedValue([]);
  processCall.mockResolvedValue({ status: "imported", agentName: "Ayşe" });
  fetchCallsByDate.mockResolvedValue({ calls: [call("c1"), call("c2"), call("c3")] });
});

describe("POST /api/calls/sync/next", () => {
  it("ADMIN olmayan 403 alır ve Kriko'ya gidilmez", async () => {
    getUserFromToken.mockResolvedValue({ id: "u", role: "TEAM_LEADER" });
    const res = await POST(req({}));
    expect(res.status).toBe(403);
    expect(fetchCallsByDate).not.toHaveBeenCalled();
  });

  it("oturum yoksa 403 alır", async () => {
    getUserFromToken.mockResolvedValue(null);
    expect((await POST(req({}))).status).toBe(403);
  });

  it("TEK çağrı işler — tavanın altında kalmanın tek yolu bu", async () => {
    // Ölçüldü: çağrı başına ~20.7 sn, Vercel Hobby tavanı 60 sn.
    const res = await POST(req({ date: "2026-09-17" }));
    const body = await res.json();
    expect(processCall).toHaveBeenCalledTimes(1);
    expect(body.processed).toBe(true);
    expect(body.callId).toBe("c1");
    expect(body.remaining).toBe(2);
  });

  it("zaten alınmış çağrıları aday saymaz", async () => {
    findMany.mockResolvedValue([{ externalCallId: "c1" }, { externalCallId: "c2" }]);
    const body = await (await POST(req({}))).json();
    expect(body.callId).toBe("c3");
    expect(body.remaining).toBe(0);
  });

  it("mevcutları TEK sorguyla sorar — çağrı başına ayrı sorgu değil", async () => {
    // Eski toplu yol çağrı başına findUnique atıyordu; ölçüldü, 200 çağrı
    // için 17,4 sn. Aynı bilgi tek findMany ile 82 ms.
    await POST(req({}));
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(findMany.mock.calls[0][0].where.externalCallId.in).toEqual(["c1", "c2", "c3"]);
  });

  it("skip listesindeki çağrıyı bir daha seçmez", async () => {
    const body = await (await POST(req({ skip: ["c1"] }))).json();
    expect(body.callId).toBe("c2");
    expect(body.remaining).toBe(1);
  });

  it("KALICI ATLANAN çağrı döngüyü kilitlemez", async () => {
    // Asıl tehlike buydu: processCall "skipped" dönerse o çağrı hiçbir zaman
    // alınmış sayılmaz, dolayısıyla her turda YİNE sıranın başına gelirdi ve
    // döngü aynı çağrıyı sonsuza kadar döverdi. İstemci işlediği her id'yi
    // skip'e eklediği için her tur adaylardan tam olarak birini düşürür.
    processCall.mockResolvedValue({ status: "skipped", reason: "no_transcript" });

    const skip: string[] = [];
    const gorulen: string[] = [];
    for (let i = 0; i < 5; i++) {
      const body = await (await POST(req({ skip }))).json();
      if (!body.processed) break;
      gorulen.push(body.callId);
      skip.push(body.callId);
    }
    expect(gorulen).toEqual(["c1", "c2", "c3"]); // her tur farklı çağrı
  });

  it("aday kalmadığında processed:false döner — döngünün duruş işareti", async () => {
    findMany.mockResolvedValue([
      { externalCallId: "c1" }, { externalCallId: "c2" }, { externalCallId: "c3" },
    ]);
    const body = await (await POST(req({}))).json();
    expect(body.processed).toBe(false);
    expect(body.remaining).toBe(0);
    expect(processCall).not.toHaveBeenCalled();
  });

  it("analiz edilebilir çağrı yoksa sorgu bile atmaz", async () => {
    fetchCallsByDate.mockResolvedValue({ calls: [call("kisa", 30)] });
    const body = await (await POST(req({}))).json();
    expect(body).toMatchObject({ processed: false, remaining: 0, analyzable: 0 });
    expect(findMany).not.toHaveBeenCalled();
  });

  it("tarih verilmezse dünü işler", async () => {
    const body = await (await POST(req({}))).json();
    expect(body.date).toBe("2026-09-16");
    expect(fetchCallsByDate).toHaveBeenCalledWith("2026-09-16");
  });

  it("gövdesiz istek geçerlidir", async () => {
    expect((await POST(req("BOZUK"))).status).toBe(200);
  });

  it("Kriko patlarsa 500 döner ve sebebi gizlemez", async () => {
    fetchCallsByDate.mockRejectedValue(new Error("kriko down"));
    const res = await POST(req({}));
    expect(res.status).toBe(500);
    expect((await res.json()).error).toContain("kriko down");
  });
});
