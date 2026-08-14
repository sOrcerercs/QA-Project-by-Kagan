import { describe, it, expect } from "vitest";
import {
  OKR_HISTORY,
  isHistoryMonth,
  getHistoryMonth,
  historyMonths,
  historyRate,
  availableMonthsWithHistory,
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
