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
import {
  DEEP_SCORE_RESERVE_MS,
  DEEP_SCORE_GEMINI_MAX_ATTEMPTS,
  geminiBudgetMs,
  remainingGeminiBudgetMs,
  classifyRescoreResponse,
} from "./rescoreStep";

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

/* ───────────────────────────────────────────────────────────────
   Zaman bütçesi — 60 sn'lik platform tavanı altında kalmalı.
   ─────────────────────────────────────────────────────────────── */
describe("geminiBudgetMs — platform tavanı", () => {
  it("tavandan pay ayırır", () => {
    expect(geminiBudgetMs(60_000, 8_000)).toBe(52_000);
  });

  it("tek denemeyle toplam süre tavanı AŞMAZ", () => {
    const cap = 60_000;
    const budget = geminiBudgetMs(cap, DEEP_SCORE_RESERVE_MS);
    // tek deneme + rezerv <= tavan
    expect(budget * DEEP_SCORE_GEMINI_MAX_ATTEMPTS + DEEP_SCORE_RESERVE_MS)
      .toBeLessThanOrEqual(cap);
  });

  it("kuyruk yolunda İÇ TEKRAR YOK — tekrar olsa tavan aşılır", () => {
    // maxAttempts 5 (kütüphane varsayılanı) olsaydı 5 x 52 sn = 260 sn.
    expect(DEEP_SCORE_GEMINI_MAX_ATTEMPTS).toBe(1);
  });

  it("pay tavandan büyükse pozitif kalır", () => {
    expect(geminiBudgetMs(5_000, 8_000)).toBeGreaterThan(0);
  });
});

/* ───────────────────────────────────────────────────────────────
   İstemci yanıt sınıflandırması.
   ASIL ARIZA: platform 504 döndüğünde gövde JSON değil, bu yüzden
   `remaining ?? 0` sıfır çıkıyor ve döngü kuyruk boşmuş gibi
   SESSİZCE duruyor — kullanıcı başarı mesajı görüyor.
   ─────────────────────────────────────────────────────────────── */
describe("classifyRescoreResponse", () => {
  it("işlenen kaydı tanır", () => {
    expect(classifyRescoreResponse(200, { processed: true, remaining: 4 }))
      .toEqual({ kind: "processed" });
  });

  it("kuyruk gerçekten boşsa empty", () => {
    expect(classifyRescoreResponse(200, { processed: false, remaining: 0 }))
      .toEqual({ kind: "empty" });
  });

  it("sunucunun JSON hatası tekrar edilebilir", () => {
    expect(classifyRescoreResponse(500, {
      processed: false, remaining: 3, error: "model zorunlu JSON bloğunu üretmedi",
    })).toEqual({ kind: "retryable", error: "model zorunlu JSON bloğunu üretmedi" });
  });

  it("PLATFORM ZAMAN AŞIMI (JSON olmayan gövde) empty DEĞİL, unavailable", () => {
    expect(classifyRescoreResponse(504, null)).toEqual({ kind: "unavailable" });
  });

  it("gövde JSON ama remaining yoksa empty sayılmaz", () => {
    expect(classifyRescoreResponse(502, {})).toEqual({ kind: "unavailable" });
  });

  it("yetkisizlik kalıcı hatadır, tekrar edilmez", () => {
    expect(classifyRescoreResponse(403, { error: "Yetkisiz." })).toEqual({ kind: "fatal", error: "Yetkisiz." });
  });
});

describe("remainingGeminiBudgetMs — geçen süreyi düşer", () => {
  it("ön iş yoksa statik bütçeye eşittir", () => {
    expect(remainingGeminiBudgetMs(0, 60_000, 8_000)).toBe(52_000);
  });

  it("ön işte geçen süreyi düşer", () => {
    expect(remainingGeminiBudgetMs(4_000, 60_000, 8_000)).toBe(48_000);
  });

  it("toplam HER ZAMAN tavanın altında kalır", () => {
    for (const elapsed of [0, 1_000, 5_000, 20_000, 55_000]) {
      const budget = remainingGeminiBudgetMs(elapsed, 60_000, 8_000);
      // taban 5 sn devreye girmediği sürece: geçen + bütçe + pay <= tavan
      if (budget > 5_000) expect(elapsed + budget + 8_000).toBeLessThanOrEqual(60_000);
    }
  });

  it("ön iş payı yemiş olsa bile 5 sn taban verir", () => {
    expect(remainingGeminiBudgetMs(58_000, 60_000, 8_000)).toBe(5_000);
  });

  it("negatif geçen süre bütçeyi şişirmez", () => {
    expect(remainingGeminiBudgetMs(-10_000, 60_000, 8_000)).toBe(52_000);
  });
});
