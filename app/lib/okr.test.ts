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
  ALL_MONTHS,
  parseCallType,
  parseAgentIds,
  filterEvaluations,
  resolveRange,
  groupByTrMonth,
  averageOfValues,
  upsellGaps,
} from "./okr";
import type { UpsellStatus } from "./upsellClassify";

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

describe("parseCallType", () => {
  it("boş veya null parametreyi ALL sayar", () => {
    expect(parseCallType(null)).toBe("ALL");
    expect(parseCallType("")).toBe("ALL");
    expect(parseCallType(undefined)).toBe("ALL");
  });

  it("geçerli değerleri aynen döner", () => {
    expect(parseCallType("ALL")).toBe("ALL");
    expect(parseCallType("FIRST_CALL")).toBe("FIRST_CALL");
    expect(parseCallType("SECOND_CALL")).toBe("SECOND_CALL");
  });

  it("geçersiz değerde hata fırlatır", () => {
    expect(() => parseCallType("THIRD_CALL")).toThrow();
    expect(() => parseCallType("first_call")).toThrow();
  });
});

describe("parseAgentIds", () => {
  it("virgülle ayrılmış id'leri ayırır ve boşlukları kırpar", () => {
    expect(parseAgentIds(" a , b ")).toEqual(["a", "b"]);
  });

  it("boş parçaları atar", () => {
    expect(parseAgentIds("a,,b,")).toEqual(["a", "b"]);
  });

  it("tekrar eden id'yi bir kez döner", () => {
    expect(parseAgentIds("a,b,a")).toEqual(["a", "b"]);
  });

  it("boş girdide boş dizi döner", () => {
    expect(parseAgentIds(null)).toEqual([]);
    expect(parseAgentIds("")).toEqual([]);
    expect(parseAgentIds("  ,  ")).toEqual([]);
  });
});

describe("filterEvaluations", () => {
  const rows = [
    { agentId: "a", score: 80, callType: "FIRST_CALL" },
    { agentId: "a", score: 90, callType: "SECOND_CALL" },
    { agentId: "b", score: 70, callType: "FIRST_CALL" },
  ];

  it("filtre yoksa hepsini döner", () => {
    expect(filterEvaluations(rows, { callType: "ALL", agentIds: [] })).toHaveLength(3);
  });

  it("çağrı tipine göre süzer", () => {
    const out = filterEvaluations(rows, { callType: "FIRST_CALL", agentIds: [] });
    expect(out.map((r) => r.score)).toEqual([80, 70]);
  });

  it("danışmana göre süzer", () => {
    const out = filterEvaluations(rows, { callType: "ALL", agentIds: ["b"] });
    expect(out.map((r) => r.score)).toEqual([70]);
  });

  it("iki filtreyi birlikte uygular", () => {
    const out = filterEvaluations(rows, { callType: "SECOND_CALL", agentIds: ["a"] });
    expect(out.map((r) => r.score)).toEqual([90]);
  });

  it("hiçbir satır eşleşmezse boş dizi döner", () => {
    expect(filterEvaluations(rows, { callType: "SECOND_CALL", agentIds: ["b"] })).toEqual([]);
  });
});

describe("resolveRange", () => {
  it("tek ay için monthRange ile aynı sonucu verir", () => {
    expect(resolveRange("2026-08", "2026-05", "2026-08")).toEqual(monthRange("2026-08"));
  });

  it("ALL için ilk ayın başından son ayın sonuna kadar uzanır", () => {
    const r = resolveRange(ALL_MONTHS, "2026-05", "2026-08");
    expect(r.start.toISOString()).toBe(monthRange("2026-05").start.toISOString());
    expect(r.end.toISOString()).toBe(monthRange("2026-08").end.toISOString());
  });

  it("geçersiz ayda hata fırlatır", () => {
    expect(() => resolveRange("2026-13", "2026-05", "2026-08")).toThrow();
  });
});

describe("groupByTrMonth", () => {
  it("çağrıları Türkiye saatine göre ayına dağıtır", () => {
    const groups = groupByTrMonth([
      { callDate: new Date("2026-08-15T10:00:00.000Z"), score: 90 },
      { callDate: new Date("2026-08-31T22:00:00.000Z"), score: 80 }, // TR: 1 Eylül
      { callDate: new Date("2026-07-31T21:30:00.000Z"), score: 70 }, // TR: 1 Ağustos
    ]);
    expect([...groups.keys()].sort()).toEqual(["2026-08", "2026-09"]);
    expect(groups.get("2026-08")!.map((r) => r.score)).toEqual([90, 70]);
    expect(groups.get("2026-09")!.map((r) => r.score)).toEqual([80]);
  });

  it("boş girdide boş harita döner", () => {
    expect(groupByTrMonth([]).size).toBe(0);
  });
});

describe("averageOfValues", () => {
  it("null olmayan değerlerin ortalamasını alır", () => {
    expect(averageOfValues([90, null, 80])).toBe(85);
  });

  it("iki basamağa yuvarlar", () => {
    expect(averageOfValues([80, 85, 91])).toBe(85.33);
  });

  it("hiç değer yoksa null döner", () => {
    expect(averageOfValues([])).toBeNull();
    expect(averageOfValues([null, null])).toBeNull();
  });
});

// İş kuralı (2026-08-14): işten ayrılan danışman bir sonraki ayın alt-5
// listesinde seçili kalsa bile o ayın değerine etki etmemeli. Önceki aydan
// devralınan seçim bu duruma doğrudan yol açıyor.
describe("bottomSellersValue — işten ayrılan danışman", () => {
  it("ayrıldıktan sonraki ayda seçili kalsa bile değere etki etmez", () => {
    const calisanlar = [
      { id: "a", name: "A", avgScore: 90, callCount: 10 },
      { id: "b", name: "B", avgScore: 80, callCount: 8 },
      { id: "c", name: "C", avgScore: 70, callCount: 5 },
      { id: "d", name: "D", avgScore: 60, callCount: 3 },
    ];
    // Ayrılan kişi: o ay hiç çağrısı yok, düşük skoru ortalamayı çekmemeli.
    const ayrilan = { id: "e", name: "Ayrılan", avgScore: null, callCount: 0 };

    expect(bottomSellersValue([...calisanlar, ayrilan])).toBe(bottomSellersValue(calisanlar));
    expect(bottomSellersValue([...calisanlar, ayrilan])).toBe(75); // 4 kişiye bölünür, 5'e değil
  });
});

describe("upsellGaps", () => {
  const row = (over: Partial<{ id: string; stemCell: string; premium: string; score: number }>) => ({
    id: "x", stemCell: "SUNULDU", premium: "SUNULDU", score: 80, ...over,
  }) as { id: string; stemCell: UpsellStatus; premium: UpsellStatus; score: number };

  it("yalnızca Stem Cell sunulmayan çağrıyı listeler", () => {
    const out = upsellGaps([row({ id: "a", stemCell: "SUNULMADI" })], "ALL");
    expect(out.map((r) => r.id)).toEqual(["a"]);
  });

  it("yalnızca Premium sunulmayan çağrıyı listeler", () => {
    const out = upsellGaps([row({ id: "b", premium: "SUNULMADI" })], "ALL");
    expect(out.map((r) => r.id)).toEqual(["b"]);
  });

  it("ikisi de sunulmuşsa listelemez", () => {
    expect(upsellGaps([row({})], "ALL")).toEqual([]);
  });

  it("NA ve BILINMIYOR eksiklik sayılmaz", () => {
    const rows = [row({ id: "na", stemCell: "NA", premium: "NA" }), row({ id: "bil", stemCell: "BILINMIYOR", premium: "BILINMIYOR" })];
    expect(upsellGaps(rows, "ALL")).toEqual([]);
  });

  it("skoru 100 olanı listelemez — kusursuz puan kuralı sunuldu sayıyor", () => {
    const out = upsellGaps([row({ id: "perfect", stemCell: "SUNULMADI", premium: "SUNULMADI", score: PERFECT_SCORE })], "ALL");
    expect(out).toEqual([]);
  });

  it("skoru 99 olanı listeler", () => {
    const out = upsellGaps([row({ id: "c", premium: "SUNULMADI", score: 99 })], "ALL");
    expect(out.map((r) => r.id)).toEqual(["c"]);
  });

  it("odak stemCell ise yalnızca Stem Cell eksiklerini döner", () => {
    const rows = [
      row({ id: "stem", stemCell: "SUNULMADI" }),
      row({ id: "prem", premium: "SUNULMADI" }),
      row({ id: "iki", stemCell: "SUNULMADI", premium: "SUNULMADI" }),
    ];
    expect(upsellGaps(rows, "stemCell").map((r) => r.id)).toEqual(["stem", "iki"]);
    expect(upsellGaps(rows, "premium").map((r) => r.id)).toEqual(["prem", "iki"]);
  });

  it("giriş sırasını korur", () => {
    const rows = [row({ id: "1", premium: "SUNULMADI" }), row({ id: "2", premium: "SUNULMADI" })];
    expect(upsellGaps(rows, "ALL").map((r) => r.id)).toEqual(["1", "2"]);
  });

  it("boş girdide boş dizi döner", () => {
    expect(upsellGaps([], "ALL")).toEqual([]);
  });
});
