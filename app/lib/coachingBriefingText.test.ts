import { describe, it, expect } from "vitest";
import { reasonBadge, reasonText } from "./coachingBriefingText";

describe("reasonBadge", () => {
  it("her gerekçe kodu için iki dilde de etiket verir", () => {
    const codes = ["RECURRING_WEAKNESS", "BIGGEST_LOSS", "STANDOUT_UP", "STANDOUT_DOWN", "GOOD_EXAMPLE", "ONLY_CALL"] as const;
    for (const c of codes) {
      expect(reasonBadge(c, "tr").length).toBeGreaterThan(0);
      expect(reasonBadge(c, "en").length).toBeGreaterThan(0);
    }
  });
});

describe("reasonText", () => {
  it("tekrar eden zayıflıkta kriter adını ve tekrar sayısını yazar", () => {
    const s = reasonText("RECURRING_WEAKNESS", { criterionLabel: "Kapanış Disiplini", occurrences: 3, windowWeeks: 4 }, "tr");
    expect(s).toContain("Kapanış Disiplini");
    expect(s).toContain("3");
    expect(s).toContain("4");
  });

  it("en büyük kayıpta puanı yazar", () => {
    expect(reasonText("BIGGEST_LOSS", { loss: 31 }, "tr")).toContain("31");
  });

  it("yukarı sapmada artı, aşağı sapmada eksi yönü ayırır", () => {
    const up = reasonText("STANDOUT_UP", { deviation: 14, average: 72 }, "tr");
    const down = reasonText("STANDOUT_DOWN", { deviation: -20, average: 72 }, "tr");
    expect(up).toContain("14");
    expect(down).toContain("20");
    expect(up).not.toBe(down);
  });

  it("ONLY_CALL'da o haftanın çağrı sayısını yazar", () => {
    expect(reasonText("ONLY_CALL", { callCount: 2 }, "tr")).toContain("2");
  });

  it("İngilizce metin Türkçesinden farklıdır", () => {
    const data = { criterionLabel: "Closing", occurrences: 3, windowWeeks: 4 };
    expect(reasonText("RECURRING_WEAKNESS", data, "en")).not.toBe(reasonText("RECURRING_WEAKNESS", data, "tr"));
  });

  it("veri eksikse çökmez, kısaltılmış cümle döner", () => {
    expect(() => reasonText("RECURRING_WEAKNESS", {}, "tr")).not.toThrow();
    expect(reasonText("BIGGEST_LOSS", {}, "tr").length).toBeGreaterThan(0);
  });

  it("ONLY_CALL İngilizcesi tek çağrıda tekil yazar", () => {
    expect(reasonText("ONLY_CALL", { callCount: 1 }, "en")).toContain("1 call this week");
    expect(reasonText("ONLY_CALL", { callCount: 1 }, "en")).not.toContain("1 calls");
    expect(reasonText("ONLY_CALL", { callCount: 3 }, "en")).toContain("3 calls");
  });
});
