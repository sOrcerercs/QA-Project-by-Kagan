import { describe, it, expect } from "vitest";
import { isQuotaExhausted, GeminiQuotaError, isGeminiQuotaError, QUOTA_ERROR_CODE } from "./geminiQuota";

describe("isQuotaExhausted", () => {
  // 2026-09-14'te prod'da ölçülen gerçek gövde.
  const harcamaTavani = JSON.stringify({
    error: {
      code: 429,
      message: "Your project has exceeded its monthly spending cap. Please go to AI Studio at https://ai.studio/spend to manage your project spend cap.",
      status: "RESOURCE_EXHAUSTED",
    },
  });

  it("harcama tavanı dolduğunda kalıcıdır", () => {
    expect(isQuotaExhausted(429, harcamaTavani)).toBe(true);
  });

  it("faturalandırma uyarısı da kalıcıdır", () => {
    expect(isQuotaExhausted(429, "You exceeded your current quota, please check your plan and billing details.")).toBe(true);
  });

  it("dakikalık hız sınırı GEÇİCİDİR — tekrar denenmeli", () => {
    // Bu gerçekten beklemekle geçer; kalıcı saymak çalışan bir yolu kırar.
    expect(isQuotaExhausted(429, "Quota exceeded for quota metric 'Generate requests per minute'")).toBe(false);
  });

  it("gövde okunamadıysa geçici varsayılır", () => {
    // Emin değilsek MEVCUT davranışı koru: tekrar dene.
    expect(isQuotaExhausted(429, "")).toBe(false);
  });

  it("429 olmayan durum kodunu sahiplenmez", () => {
    expect(isQuotaExhausted(500, harcamaTavani)).toBe(false);
    expect(isQuotaExhausted(503, harcamaTavani)).toBe(false);
  });
});

describe("GeminiQuotaError", () => {
  it("kendi tipini tanır", () => {
    expect(isGeminiQuotaError(new GeminiQuotaError("dolu"))).toBe(true);
  });
  it("sıradan hatayı sahiplenmez", () => {
    expect(isGeminiQuotaError(new Error("Google AI API hatası: 500"))).toBe(false);
  });
  it("Error olmayan değeri sahiplenmez", () => {
    expect(isGeminiQuotaError("dolu")).toBe(false);
    expect(isGeminiQuotaError(null)).toBe(false);
  });
  it("istemciye taşınacak kod sabittir", () => {
    // Panel bu DİZGİYE bakıyor; hata METNİNE değil. Metin değişirse
    // (Google'ın cümlesi, çeviri) sınıflandırma bozulmamalı.
    expect(QUOTA_ERROR_CODE).toBe("quota_exhausted");
  });
});
