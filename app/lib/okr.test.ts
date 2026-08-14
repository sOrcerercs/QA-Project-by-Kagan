import { describe, it, expect } from "vitest";
import {
  monthRange,
  currentMonth,
  previousMonth,
  monthsBetween,
  averageScore,
  upsellRate,
  agentAverages,
  bottomSellersValue,
  okrStatus,
  OKR_TARGETS,
  PERFECT_SCORE,
} from "./okr";

describe("monthRange", () => {
  it("ayı Türkiye saatiyle (UTC+3) keser", () => {
    const { start, end } = monthRange("2026-08");
    expect(start.toISOString()).toBe("2026-07-31T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-08-31T20:59:59.999Z");
  });

  it("yıl dönümünü doğru işler", () => {
    const { start, end } = monthRange("2026-12");
    expect(start.toISOString()).toBe("2026-11-30T21:00:00.000Z");
    expect(end.toISOString()).toBe("2026-12-31T20:59:59.999Z");
  });

  it("Türkiye saatiyle 1 Eylül 01:00'deki çağrı Ağustos'a girmez", () => {
    const call = new Date("2026-08-31T22:00:00.000Z"); // TR: 1 Eylül 01:00
    const agustos = monthRange("2026-08");
    const eylul = monthRange("2026-09");
    expect(call > agustos.end).toBe(true);
    expect(call >= eylul.start && call <= eylul.end).toBe(true);
  });

  it("geçersiz biçimde hata fırlatır", () => {
    expect(() => monthRange("2026-8")).toThrow();
    expect(() => monthRange("2026-13")).toThrow();
    expect(() => monthRange("saçma")).toThrow();
  });
});

describe("currentMonth / previousMonth / monthsBetween", () => {
  it("içinde bulunulan ayı TR saatiyle verir", () => {
    expect(currentMonth(new Date("2026-08-31T22:00:00.000Z"))).toBe("2026-09");
    expect(currentMonth(new Date("2026-08-14T09:00:00.000Z"))).toBe("2026-08");
  });

  it("önceki ayı verir, yıl dönümünde de", () => {
    expect(previousMonth("2026-08")).toBe("2026-07");
    expect(previousMonth("2026-01")).toBe("2025-12");
  });

  it("iki ay arasını kapsayıcı listeler", () => {
    expect(monthsBetween("2026-05", "2026-08")).toEqual(["2026-05", "2026-06", "2026-07", "2026-08"]);
    expect(monthsBetween("2026-08", "2026-08")).toEqual(["2026-08"]);
  });
});

describe("averageScore", () => {
  it("2 ondalığa yuvarlar", () => {
    expect(averageScore([{ score: 99 }, { score: 100 }, { score: 100 }])).toBe(99.67);
  });

  it("boş listede null döner", () => {
    expect(averageScore([])).toBeNull();
  });
});

describe("upsellRate", () => {
  // score alanı 100'ün altında tutuluyor ki kusursuz puan kuralı devreye girmesin
  const rows = [
    { stemCell: "SUNULDU", premium: "SUNULDU", score: 85 },
    { stemCell: "SUNULDU", premium: "SUNULMADI", score: 90 },
    { stemCell: "SUNULMADI", premium: "NA", score: 70 },
    { stemCell: "NA", premium: "NA", score: 88 },
    { stemCell: "BILINMIYOR", premium: "BILINMIYOR", score: 60 },
  ] as const;

  it("NA ve BILINMIYOR'u paydadan düşürür", () => {
    const r = upsellRate([...rows], "stemCell");
    expect(r.presented).toBe(2);
    expect(r.notPresented).toBe(1);
    expect(r.na).toBe(1);
    expect(r.unknown).toBe(1);
    expect(r.value).toBe(66.67);
    expect(r.perfectScoreOverrides).toBe(0);
  });

  it("premium alanını ayrı hesaplar", () => {
    const r = upsellRate([...rows], "premium");
    expect(r.presented).toBe(1);
    expect(r.notPresented).toBe(1);
    expect(r.value).toBe(50);
  });

  it("payda sıfırsa null döner", () => {
    const r = upsellRate([{ stemCell: "NA", premium: "NA", score: 80 }], "stemCell");
    expect(r.value).toBeNull();
    expect(r.na).toBe(1);
  });

  it("boş listede null döner", () => {
    expect(upsellRate([], "stemCell").value).toBeNull();
  });

  it("skor 100 ise SUNULMADI'yı SUNULDU sayar ve override'ı raporlar", () => {
    const r = upsellRate([{ stemCell: "SUNULMADI", premium: "SUNULMADI", score: 100 }], "stemCell");
    expect(r.presented).toBe(1);
    expect(r.notPresented).toBe(0);
    expect(r.value).toBe(100);
    expect(r.perfectScoreOverrides).toBe(1);
  });

  it("skor 100 ise NA'yı da SUNULDU sayar ve paydaya sokar", () => {
    const r = upsellRate([{ stemCell: "NA", premium: "NA", score: 100 }], "stemCell");
    expect(r.presented).toBe(1);
    expect(r.na).toBe(0);
    expect(r.value).toBe(100);
    expect(r.perfectScoreOverrides).toBe(1);
  });

  it("skor 100 ve zaten SUNULDU ise override sayılmaz", () => {
    const r = upsellRate([{ stemCell: "SUNULDU", premium: "SUNULDU", score: 100 }], "stemCell");
    expect(r.presented).toBe(1);
    expect(r.perfectScoreOverrides).toBe(0);
  });

  it("skor 99 kuralı tetiklemez", () => {
    const r = upsellRate([{ stemCell: "SUNULMADI", premium: "SUNULMADI", score: 99 }], "stemCell");
    expect(r.presented).toBe(0);
    expect(r.notPresented).toBe(1);
    expect(r.value).toBe(0);
    expect(r.perfectScoreOverrides).toBe(0);
  });
});

describe("agentAverages", () => {
  const names = new Map([["a", "Ayşe"], ["b", "Mehmet"]]);

  it("danışman başına ortalama ve çağrı sayısı üretir, skora göre artan sıralar", () => {
    const out = agentAverages(
      [
        { agentId: "a", score: 100 },
        { agentId: "a", score: 98 },
        { agentId: "b", score: 90 },
      ],
      names
    );
    expect(out).toEqual([
      { id: "b", name: "Mehmet", avgScore: 90, callCount: 1 },
      { id: "a", name: "Ayşe", avgScore: 99, callCount: 2 },
    ]);
  });

  it("adı bilinmeyen danışmanı id'siyle gösterir", () => {
    const out = agentAverages([{ agentId: "z", score: 80 }], names);
    expect(out[0].name).toBe("z");
  });

  it("boş girdide boş dizi döner", () => {
    expect(agentAverages([], names)).toEqual([]);
  });
});

describe("bottomSellersValue", () => {
  it("veri olan kişilerin ortalamasını alır", () => {
    expect(
      bottomSellersValue([
        { id: "a", name: "A", avgScore: 98, callCount: 4 },
        { id: "b", name: "B", avgScore: 96, callCount: 2 },
      ])
    ).toBe(97);
  });

  it("çağrısı olmayan kişiyi ortalamaya katmaz", () => {
    expect(
      bottomSellersValue([
        { id: "a", name: "A", avgScore: 98, callCount: 4 },
        { id: "b", name: "B", avgScore: null, callCount: 0 },
      ])
    ).toBe(98);
  });

  it("hiç veri yoksa null döner", () => {
    expect(bottomSellersValue([{ id: "b", name: "B", avgScore: null, callCount: 0 }])).toBeNull();
    expect(bottomSellersValue([])).toBeNull();
  });
});

describe("okrStatus", () => {
  it("hedefe ulaşılınca TAMAMLANDI", () => {
    expect(okrStatus(99.5, OKR_TARGETS.quality)).toBe("TAMAMLANDI");
    expect(okrStatus(100, OKR_TARGETS.quality)).toBe("TAMAMLANDI");
  });

  it("hedefin %95'i ve üstü YOLUNDA", () => {
    expect(okrStatus(91, 95)).toBe("YOLUNDA");   // oran 0.958
    expect(okrStatus(90.25, 95)).toBe("YOLUNDA"); // oran tam 0.95
  });

  it("altı RISKLI", () => {
    expect(okrStatus(80, 95)).toBe("RISKLI");
  });

  it("değer yoksa VERI_YOK", () => {
    expect(okrStatus(null, 95)).toBe("VERI_YOK");
  });
});
