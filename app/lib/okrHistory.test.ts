import { describe, it, expect } from "vitest";
import {
  OKR_HISTORY,
  isHistoryMonth,
  getHistoryMonth,
  historyMonths,
  historyRate,
  availableMonthsWithHistory,
  historyTotals,
  poolUpsellWithHistory,
  poolQualityWithHistory,
} from "./okrHistory";
import { ALL_MONTHS } from "./okr";

describe("getHistoryMonth / isHistoryMonth", () => {
  it("elle girilen ayı döner", () => {
    expect(getHistoryMonth("2026-02")?.evaCount).toBe(195);
    expect(isHistoryMonth("2026-02")).toBe(true);
  });

  it("hesaplanan ay için null döner", () => {
    expect(getHistoryMonth("2026-05")).toBeNull();
    expect(isHistoryMonth("2026-05")).toBe(false);
    expect(isHistoryMonth(ALL_MONTHS)).toBe(false);
  });
});

describe("historyMonths", () => {
  it("ayları artan sırada verir", () => {
    expect(historyMonths()).toEqual(["2026-02", "2026-03"]);
  });
});

describe("historyRate", () => {
  // Excel dosyasındaki oranlar (0,91 / 0,88) tek ondalığa yuvarlanmıştı;
  // ham sayılardan hesaplayıp iki ondalık gösteriyoruz.
  it("Şubat oranlarını sayılardan hesaplar", () => {
    expect(historyRate(OKR_HISTORY["2026-02"], "stemCell")).toBe(91.28); // 178/195
    expect(historyRate(OKR_HISTORY["2026-02"], "premium")).toBe(88.21); // 172/195
  });

  it("Mart oranlarını sayılardan hesaplar", () => {
    expect(historyRate(OKR_HISTORY["2026-03"], "stemCell")).toBe(90.52); // 210/232
    expect(historyRate(OKR_HISTORY["2026-03"], "premium")).toBe(86.21); // 200/232
  });

  it("payda sıfırsa null döner", () => {
    expect(historyRate({ quality: 0, qualityAgents: 0, evaCount: 0, stemCell: 0, premium: 0 }, "stemCell")).toBeNull();
  });
});

describe("availableMonthsWithHistory", () => {
  it("ALL, hesaplanan aylar (yeniden eskiye), sonra elle girilen aylar sırasıyla gelir", () => {
    expect(availableMonthsWithHistory("2026-05", "2026-08")).toEqual([
      ALL_MONTHS,
      "2026-08", "2026-07", "2026-06", "2026-05",
      "2026-03", "2026-02",
    ]);
  });

  it("elle girilen aylar hesaplananlarla tekrarlanmaz", () => {
    const out = availableMonthsWithHistory("2026-02", "2026-03");
    expect(out.filter((m) => m === "2026-02")).toHaveLength(1);
    expect(out.filter((m) => m === "2026-03")).toHaveLength(1);
  });
});

describe("OKR_HISTORY verisi", () => {
  it("Excel'deki toplam satırlarıyla birebir aynı", () => {
    expect(OKR_HISTORY["2026-02"]).toEqual({
      quality: 78.45, qualityAgents: 18, evaCount: 195, stemCell: 178, premium: 172,
    });
    expect(OKR_HISTORY["2026-03"]).toEqual({
      quality: 82.48, qualityAgents: 20, evaCount: 232, stemCell: 210, premium: 200,
    });
  });

  it("sunulan sayı toplam değerlendirmeyi aşmaz", () => {
    for (const m of historyMonths()) {
      const h = OKR_HISTORY[m];
      expect(h.stemCell).toBeLessThanOrEqual(h.evaCount);
      expect(h.premium).toBeLessThanOrEqual(h.evaCount);
    }
  });
});

describe("historyTotals", () => {
  it("iki ayın ham sayılarını toplar", () => {
    const t = historyTotals();
    expect(t.evaCount).toBe(195 + 232);
    expect(t.stemCell).toBe(178 + 210);
    expect(t.premium).toBe(172 + 200);
  });

  it("kaliteyi evaCount ile ağırlıklandırarak toplar", () => {
    expect(historyTotals().qualityWeightedSum).toBeCloseTo(78.45 * 195 + 82.48 * 232, 6);
  });
});

describe("poolUpsellWithHistory", () => {
  const rate = {
    value: 50, presented: 100, notPresented: 100, na: 7, unknown: 3,
    perfectScoreOverrides: 0, premiumCoverExclusions: 0, budgetExclusions: 0, fixedChoiceExclusions: 0,
  };

  it("sunulanı ekler, kalanını sunulmadıya yazar", () => {
    const out = poolUpsellWithHistory(rate, "stemCell");
    expect(out.presented).toBe(100 + 388);
    expect(out.notPresented).toBe(100 + (427 - 388));
    expect(out.value).toBe(77.83); // 488/627
  });

  it("premium alanı için premium sayılarını kullanır", () => {
    const out = poolUpsellWithHistory(rate, "premium");
    expect(out.presented).toBe(100 + 372);
    expect(out.notPresented).toBe(100 + (427 - 372));
  });

  it("NA, bilinmiyor ve dışlama sayaçlarına dokunmaz", () => {
    const out = poolUpsellWithHistory(rate, "stemCell");
    expect(out.na).toBe(7);
    expect(out.unknown).toBe(3);
    expect(out.premiumCoverExclusions).toBe(0);
  });

  it("payda sıfırken bile geçmiş aylardan değer üretir", () => {
    const bos = { ...rate, value: null, presented: 0, notPresented: 0 };
    expect(poolUpsellWithHistory(bos, "stemCell").value).toBe(90.87);
  });
});

describe("poolQualityWithHistory", () => {
  it("çağrı sayısıyla ağırlıklı ortalama alır", () => {
    const out = poolQualityWithHistory({ value: 81.5, count: 3371 });
    expect(out.count).toBe(3371 + 427);
    expect(out.value).toBe(81.4);
  });

  it("hesaplanan ay yoksa yalnızca geçmiş aylardan hesaplar", () => {
    const out = poolQualityWithHistory({ value: null, count: 0 });
    expect(out.count).toBe(427);
    expect(out.value).toBe(80.64);
  });
});
