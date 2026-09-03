import { describe, it, expect } from "vitest";
import {
  buildEvaluationPrompt,
  pendingWhere,
  isStaleLock,
  nextAttemptsExhausted,
  DEEP_SCORE_MAX_ATTEMPTS,
  DEEP_SCORE_FROM,
  type RescoreTarget,
} from "./deepScore";

const target: RescoreTarget = {
  id: "e1",
  customerName: "Sundeep Singh",
  callDuration: "4:56",
  transcript: "[00:01] SDR: Hello",
  callType: "FIRST_CALL",
  score: 53,
  callDate: new Date("2026-09-03T10:00:00.000Z"),
  agentName: "Yurdagül Esen",
  teamName: "Sümeyra Demir'in Takımı",
};

describe("buildEvaluationPrompt", () => {
  const out = buildEvaluationPrompt("PROMPT GÖVDESİ", target);

  it("prompt gövdesini en başa koyar", () => {
    expect(out.startsWith("PROMPT GÖVDESİ")).toBe(true);
  });

  it("görüşme bilgilerini ve transkripti ekler", () => {
    expect(out).toContain("Temsilci Adı: Yurdagül Esen");
    expect(out).toContain("Takım: Sümeyra Demir'in Takımı");
    expect(out).toContain("Müşteri Adı: Sundeep Singh");
    expect(out).toContain("Görüşme Süresi: 4:56");
    expect(out).toContain("=== TRANSKRİPT ===");
    expect(out).toContain("[00:01] SDR: Hello");
  });

  it("eksik danışman/takım için güvenli varsayılan yazar", () => {
    const o = buildEvaluationPrompt("X", { ...target, agentName: null, teamName: null });
    expect(o).toContain("Temsilci Adı: Belirtilmedi");
    expect(o).toContain("Takım: Belirtilmedi");
  });
});

describe("pendingWhere — kapsam", () => {
  it("yalnızca damgalanmamış kayıtları seçer", () => {
    const w = pendingWhere() as { deepScoredAt: unknown };
    expect(w.deepScoredAt).toBeNull();
  });

  it("deneme hakkı dolanları dışarıda bırakır", () => {
    const w = pendingWhere() as { deepScoreAttempts: { lt: number } };
    expect(w.deepScoreAttempts.lt).toBe(DEEP_SCORE_MAX_ATTEMPTS);
  });

  it("kesme tarihinden ÖNCEKİ kayıtları hiç kapsamaz", () => {
    const w = pendingWhere() as { callDate: { gte: Date } };
    expect(w.callDate.gte).toEqual(DEEP_SCORE_FROM);
  });

  it("kesme tarihi 3 Eylül 2026 (TR)", () => {
    expect(DEEP_SCORE_FROM.toISOString()).toBe("2026-09-02T21:00:00.000Z");
  });

  it("verilen aralık kesme tarihinden eskiyse kesme tarihi kazanır", () => {
    const w = pendingWhere({ from: new Date("2026-06-01T00:00:00.000Z") }) as { callDate: { gte: Date } };
    expect(w.callDate.gte).toEqual(DEEP_SCORE_FROM);
  });

  it("verilen aralık kesme tarihinden yeniyse o kullanılır", () => {
    const from = new Date("2026-09-10T00:00:00.000Z");
    const w = pendingWhere({ from }) as { callDate: { gte: Date } };
    expect(w.callDate.gte).toEqual(from);
  });

  it("üst sınır verilirse eklenir", () => {
    const to = new Date("2026-09-11T00:00:00.000Z");
    const w = pendingWhere({ to }) as { callDate: { lt: Date } };
    expect(w.callDate.lt).toEqual(to);
  });
});

describe("isStaleLock", () => {
  const now = new Date("2026-09-03T12:00:00.000Z");

  it("kilitlenmemiş satır bayat değildir", () => {
    expect(isStaleLock(null, now)).toBe(false);
  });

  it("yeni kilit bayat değildir", () => {
    expect(isStaleLock(new Date("2026-09-03T11:59:00.000Z"), now)).toBe(false);
  });

  it("eşik aşılınca bayat sayılır", () => {
    expect(isStaleLock(new Date("2026-09-03T11:54:00.000Z"), now)).toBe(true);
  });
});

describe("nextAttemptsExhausted", () => {
  it("deneme hakkı varken false", () => {
    expect(nextAttemptsExhausted(1)).toBe(false);
    expect(nextAttemptsExhausted(DEEP_SCORE_MAX_ATTEMPTS - 1)).toBe(false);
  });

  it("hak dolunca true", () => {
    expect(nextAttemptsExhausted(DEEP_SCORE_MAX_ATTEMPTS)).toBe(true);
    expect(nextAttemptsExhausted(DEEP_SCORE_MAX_ATTEMPTS + 1)).toBe(true);
  });
});
