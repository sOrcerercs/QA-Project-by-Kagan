import { describe, it, expect } from "vitest";
import {
  evaluationLoss,
  selectRecurringWeakness,
  selectBiggestLoss,
  selectStandout,
  pickEvidence,
  buildBriefing,
  type BriefingEval,
} from "./coachingBriefing";

function ev(over: Partial<BriefingEval> = {}): BriefingEval {
  return {
    id: "e1",
    customerName: "Ali Veli",
    callDate: "2026-09-15T09:00:00.000Z",
    score: 80,
    weakCriteria: null,
    reportData: null,
    coachingDone: false,
    ...over,
  };
}

describe("evaluationLoss", () => {
  it("bloktaki kriter kayıplarını yüzdeye çevirir", () => {
    const e = ev({
      score: 70,
      reportData: {
        weakCriteria: [
          { id: "A3", label: "Medikal Profil", loss: 0.75, weight: 1.5 },
          { id: "C3", label: "Kapanış", loss: 2.25, weight: 3 },
        ],
      },
    });
    // Elle türetme (buildReportCard `points` toplamı):
    //   A3: max 1.5, loss 0.75 → earned 1.5 − 0.75 = 0.75
    //   C3: max 3.0, loss 2.25 → earned 3.0 − 2.25 = 0.75
    //   points = { earned 1.5, max 4.5 }
    //   kayıp% = (4.5 − 1.5) / 4.5 × 100 = 66.666…  → 0.1 hassasiyetle 66.7
    expect(evaluationLoss(e)).toBe(66.7);
  });

  it("loss yoksa max - earned'dan türetir ve yüzdeye çevirir", () => {
    const e = ev({
      score: 70,
      reportData: { weakCriteria: [{ id: "A3", label: "Medikal", earned: 0.5, weight: 1.5 }] },
    });
    // points = { earned 0.5, max 1.5 } → (1.5 − 0.5) / 1.5 × 100 = 66.666… → 66.7
    expect(evaluationLoss(e)).toBe(66.7);
  });

  it("blok yoksa 100 - score'a düşer", () => {
    expect(evaluationLoss(ev({ score: 62, reportData: null }))).toBe(38);
  });

  it("boş blok da bloksuz kayıt gibi 100 - score'a düşer", () => {
    // Tasarım gereği buildReportCard'da boş blockFaults, üst seviye weakCriteria'ya düşüyor.
    // İkisi de null sonuç veriyor, bu ikiye ayrı test açmamız gereksiz olsa da
    // bloktaki faultSource seçimini doğrulamak için ayrı tutulur.
    const e = ev({ score: 95, reportData: { weakCriteria: [] } });
    expect(evaluationLoss(e)).toBe(5);
  });

  it("blok yoksa eski weakCriteria kolonundan kayıp türetir", () => {
    const e = ev({
      score: 62,
      reportData: null,
      weakCriteria: [{ id: "A3", label: "Medikal", earned: 0.5, weight: 1.5 }],
    });
    // 100 - 62 = 38 yedeğine DÜŞMEZ; kayıp eski kolondan gelir.
    // points = { earned 0.5, max 1.5 } → (1.5 − 0.5) / 1.5 × 100 = 66.666… → 66.7
    expect(evaluationLoss(e)).toBe(66.7);
  });

  it("kusursuz çağrıda sıfır döner", () => {
    expect(evaluationLoss(ev({ score: 100, reportData: null }))).toBe(0);
  });
});

const wc = (rows: Array<{ id: string; label: string; score: number }>) => rows;

describe("selectRecurringWeakness", () => {
  it("en sık tekrar eden kriteri bulur ve o kriterin en dibe vurduğu çağrıyı önce sıralar", () => {
    const history = [
      ev({ id: "h1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 40 }]) }),
      ev({ id: "h2", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 55 }]) }),
      ev({ id: "h3", weakCriteria: wc([{ id: "A1", label: "Selamlama", score: 60 }]) }),
    ];
    const week = [
      ev({ id: "w1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 50 }]) }),
      ev({ id: "w2", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 20 }]) }),
    ];
    const out = selectRecurringWeakness(week, history, 4);
    expect(out.map((c) => c.evaluationId)).toEqual(["w2", "w1"]);
    expect(out[0].reason).toBe("RECURRING_WEAKNESS");
    expect(out[0].reasonData).toMatchObject({
      criterionId: "C3",
      criterionLabel: "Kapanış",
      occurrences: 2,
      windowWeeks: 4,
    });
  });

  it("hiçbir kriter iki kez geçmiyorsa boş döner", () => {
    const history = [
      ev({ id: "h1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 40 }]) }),
      ev({ id: "h2", weakCriteria: wc([{ id: "A1", label: "Selamlama", score: 40 }]) }),
    ];
    const week = [ev({ id: "w1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 50 }]) })];
    expect(selectRecurringWeakness(week, history, 4)).toEqual([]);
  });

  it("tekrar eden kriter o hafta hiç geçmiyorsa boş döner", () => {
    const history = [
      ev({ id: "h1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 40 }]) }),
      ev({ id: "h2", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 45 }]) }),
    ];
    const week = [ev({ id: "w1", weakCriteria: wc([{ id: "A1", label: "Selamlama", score: 50 }]) })];
    expect(selectRecurringWeakness(week, history, 4)).toEqual([]);
  });

  it("weakCriteria boş ya da dizi değilse çökmez", () => {
    const history = [ev({ id: "h1", weakCriteria: null }), ev({ id: "h2", weakCriteria: "bozuk" })];
    const week = [ev({ id: "w1", weakCriteria: undefined })];
    expect(selectRecurringWeakness(week, history, 4)).toEqual([]);
  });

  it("beraberlikte ortalama kriter skoru düşük olanı seçer", () => {
    const history = [
      ev({ id: "h1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 70 }, { id: "A1", label: "Selamlama", score: 20 }]) }),
      ev({ id: "h2", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 70 }, { id: "A1", label: "Selamlama", score: 30 }]) }),
    ];
    const week = [
      ev({ id: "w1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 65 }, { id: "A1", label: "Selamlama", score: 25 }]) }),
    ];
    const out = selectRecurringWeakness(week, history, 4);
    expect(out[0].reasonData.criterionId).toBe("A1");
  });

  it("eşit kriter skorunda id'ye göre belirlenimci sıralar", () => {
    const history = [
      ev({ id: "h1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 40 }]) }),
      ev({ id: "h2", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 45 }]) }),
    ];
    const wA = ev({ id: "wA", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 30 }]) });
    const wB = ev({ id: "wB", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 30 }]) });
    const first = selectRecurringWeakness([wB, wA], history, 4);
    const second = selectRecurringWeakness([wA, wB], history, 4);
    expect(first.map((c) => c.evaluationId)).toEqual(["wA", "wB"]);
    expect(first.map((c) => c.evaluationId)).toEqual(second.map((c) => c.evaluationId));
  });
});

describe("selectBiggestLoss", () => {
  it("kaybı büyükten küçüğe sıralar", () => {
    const week = [
      ev({ id: "w1", score: 90 }),
      ev({ id: "w2", score: 55 }),
      ev({ id: "w3", score: 78 }),
    ];
    const out = selectBiggestLoss(week);
    expect(out.map((c) => c.evaluationId)).toEqual(["w2", "w3", "w1"]);
    expect(out[0].reason).toBe("BIGGEST_LOSS");
    expect(out[0].reasonData.loss).toBe(45);
  });

  it("kusursuz çağrıları eler", () => {
    const week = [ev({ id: "w1", score: 100 }), ev({ id: "w2", score: 70 })];
    expect(selectBiggestLoss(week).map((c) => c.evaluationId)).toEqual(["w2"]);
  });

  it("boş haftada boş döner", () => {
    expect(selectBiggestLoss([])).toEqual([]);
  });

  it("eşit kayıpta id'ye göre belirlenimci sıralar", () => {
    const a = selectBiggestLoss([ev({ id: "wB", score: 70 }), ev({ id: "wA", score: 70 })]);
    const b = selectBiggestLoss([ev({ id: "wA", score: 70 }), ev({ id: "wB", score: 70 })]);
    expect(a.map((c) => c.evaluationId)).toEqual(["wA", "wB"]);
    expect(a.map((c) => c.evaluationId)).toEqual(b.map((c) => c.evaluationId));
  });
});

describe("selectStandout", () => {
  const history = [
    ev({ id: "h1", score: 70 }),
    ev({ id: "h2", score: 70 }),
    ev({ id: "h3", score: 70 }),
    ev({ id: "h4", score: 70 }),
  ];

  it("yukarı sapmayı STANDOUT_UP olarak işaretler", () => {
    const week = [ev({ id: "w1", score: 88 })];
    const out = selectStandout(week, history);
    expect(out[0].reason).toBe("STANDOUT_UP");
    expect(out[0].reasonData).toMatchObject({ deviation: 18, average: 70 });
  });

  it("aşağı sapmayı STANDOUT_DOWN olarak işaretler", () => {
    const week = [ev({ id: "w1", score: 50 })];
    const out = selectStandout(week, history);
    expect(out[0].reason).toBe("STANDOUT_DOWN");
    expect(out[0].reasonData.deviation).toBe(-20);
  });

  it("mutlak sapması büyük olanı öne alır", () => {
    const week = [ev({ id: "w1", score: 78 }), ev({ id: "w2", score: 45 })];
    expect(selectStandout(week, history).map((c) => c.evaluationId)).toEqual(["w2", "w1"]);
  });

  it("eşik altındaki sapmaları eler", () => {
    const week = [ev({ id: "w1", score: 73 })];
    expect(selectStandout(week, history)).toEqual([]);
  });

  it("geçmiş üç değerlendirmeden azsa ortalamaya güvenmez", () => {
    const week = [ev({ id: "w1", score: 95 })];
    expect(selectStandout(week, [ev({ id: "h1", score: 60 }), ev({ id: "h2", score: 60 })])).toEqual([]);
  });

  it("hepsi aynı skorsa boş döner", () => {
    const week = [ev({ id: "w1", score: 70 })];
    expect(selectStandout(week, history)).toEqual([]);
  });

  it("eşit mutlak sapmada id'ye göre belirlenimci sıralar", () => {
    // 85 (+15) ve 55 (-15): mutlak sapma eşit, yön farklı.
    const a = selectStandout([ev({ id: "wB", score: 85 }), ev({ id: "wA", score: 55 })], history);
    const b = selectStandout([ev({ id: "wA", score: 55 }), ev({ id: "wB", score: 85 })], history);
    expect(a.map((c) => c.evaluationId)).toEqual(["wA", "wB"]);
    expect(a.map((c) => c.evaluationId)).toEqual(b.map((c) => c.evaluationId));
  });
});

const blockWith = {
  passedCriteria: [
    {
      id: "A1", label: "Kimlik ve İzin", earned: 3, weight: 3,
      evidence: [{ speaker: "Danışman", timestamp: "00:11", text: "This is Billy from Estenove." }],
    },
  ],
  weakCriteria: [
    {
      id: "A3", label: "Medikal Profil", loss: 0.75, weight: 1.5, score: 50,
      whatHappened: "Takip sorusu sorulmadı.",
      shouldHaveSaid: "Was it done in Turkey?",
      evidence: [{ speaker: "Danışman", timestamp: "00:54", text: "Okay. Perfect." }],
    },
    {
      id: "C3", label: "Kapanış Disiplini", loss: 2.25, weight: 3, score: 25,
      shouldHaveSaid: "Yarın 14:00'te arıyorum, teyit ediyorum.",
      evidence: [
        { speaker: "Danışman", timestamp: "07:02", text: "Fotoğrafları alınca ararım." },
        { speaker: "Danışan", timestamp: "07:09", text: "Tamam." },
        { speaker: "Danışman", timestamp: "07:20", text: "Görüşürüz." },
      ],
    },
  ],
};

/** Promptun hazır çevirisini taşıyan blok — "<alan>En" alanları. */
const blockBilingual = {
  weakCriteria: [
    {
      id: "C3", label: "Kapanış Disiplini", labelEn: "Closing Discipline",
      loss: 2.25, weight: 3,
      shouldHaveSaid: "Yarın 14:00'te arıyorum.",
      shouldHaveSaidEn: "I will call you tomorrow at 2 pm.",
      evidence: [{ speaker: "Danışman", timestamp: "07:02", text: "Fotoğrafları alınca ararım." }],
    },
  ],
};

describe("pickEvidence", () => {
  it("tekrar eden zayıflıkta O kriterin kanıtını ve shouldHaveSaid'ini verir", () => {
    const d = pickEvidence(ev({ reportData: blockWith }), "RECURRING_WEAKNESS", { criterionId: "A3" });
    expect(d.criterionLabel).toBe("Medikal Profil");
    expect(d.shouldHaveSaid).toBe("Was it done in Turkey?");
    expect(d.evidence).toEqual([{ speakerLabel: "Danışman", ts: "00:54", text: "Okay. Perfect." }]);
  });

  it("en büyük kayıpta en çok puan kaybettiren maddeye bakar", () => {
    const d = pickEvidence(ev({ reportData: blockWith }), "BIGGEST_LOSS", {});
    expect(d.criterionLabel).toBe("Kapanış Disiplini");
    expect(d.shouldHaveSaid).toBe("Yarın 14:00'te arıyorum, teyit ediyorum.");
  });

  it("kanıtı en fazla ikiyle sınırlar", () => {
    const d = pickEvidence(ev({ reportData: blockWith }), "BIGGEST_LOSS", {});
    expect(d.evidence).toHaveLength(2);
  });

  it("pozitif gerekçede iyi yapılan maddenin kanıtını verir, shouldHaveSaid vermez", () => {
    const d = pickEvidence(ev({ reportData: blockWith }), "GOOD_EXAMPLE", {});
    expect(d.criterionLabel).toBe("Kimlik ve İzin");
    expect(d.shouldHaveSaid).toBeNull();
    expect(d.evidence[0].text).toBe("This is Billy from Estenove.");
  });

  it("STANDOUT_UP de pozitif sayılır", () => {
    const d = pickEvidence(ev({ reportData: blockWith }), "STANDOUT_UP", {});
    expect(d.criterionLabel).toBe("Kimlik ve İzin");
  });

  it("blok yoksa boş detay döner, çökmez", () => {
    const d = pickEvidence(ev({ reportData: null, weakCriteria: null }), "BIGGEST_LOSS", {});
    expect(d).toEqual({ evidence: [], shouldHaveSaid: null, criterionLabel: null });
  });

  it("lang=en etiketi ve shouldHaveSaid'i İngilizce alanlardan okur", () => {
    const tr = pickEvidence(ev({ reportData: blockBilingual }), "BIGGEST_LOSS", {});
    expect(tr.criterionLabel).toBe("Kapanış Disiplini");
    expect(tr.shouldHaveSaid).toBe("Yarın 14:00'te arıyorum.");

    const en = pickEvidence(ev({ reportData: blockBilingual }), "BIGGEST_LOSS", {}, "en");
    expect(en.criterionLabel).toBe("Closing Discipline");
    expect(en.shouldHaveSaid).toBe("I will call you tomorrow at 2 pm.");
    // Alıntı ASLA çevrilmez — tasarım gereği hep orijinal dilinde kalır.
    expect(en.evidence[0].text).toBe("Fotoğrafları alınca ararım.");
  });

  it("aranan kriter blokta yoksa en büyük kayba düşer", () => {
    const d = pickEvidence(ev({ reportData: blockWith }), "RECURRING_WEAKNESS", { criterionId: "ZZ" });
    expect(d.criterionLabel).toBe("Kapanış Disiplini");
  });
});

const build = (week: BriefingEval[], history: BriefingEval[] = []) =>
  buildBriefing({ agentId: "a1", agentName: "Ayşe Yıldız", week, history, windowWeeks: 4 });

describe("buildBriefing", () => {
  it("çağrı yoksa boş liste döner, hata değil", () => {
    const b = build([]);
    expect(b.picks).toEqual([]);
    expect(b.callCount).toBe(0);
    expect(b.averageScore).toBeNull();
    expect(b.agentName).toBe("Ayşe Yıldız");
  });

  it("tek çağrıda o çağrıyı yine listeler", () => {
    const b = build([ev({ id: "w1", score: 82 })]);
    expect(b.picks).toHaveLength(1);
    expect(b.picks[0].evaluationId).toBe("w1");
    expect(b.callCount).toBe(1);
    expect(b.averageScore).toBe(82);
  });

  it("üç ya da daha az çağrıda hepsini listeler", () => {
    const week = [ev({ id: "w1", score: 90 }), ev({ id: "w2", score: 60 }), ev({ id: "w3", score: 75 })];
    const b = build(week);
    expect(new Set(b.picks.map((p) => p.evaluationId))).toEqual(new Set(["w1", "w2", "w3"]));
  });

  it("seçilmeyen çağrılar ONLY_CALL gerekçesiyle ve hafta sayısıyla gelir", () => {
    const b = build([ev({ id: "w1", score: 100 }), ev({ id: "w2", score: 100 })]);
    const only = b.picks.filter((p) => p.reason === "ONLY_CALL");
    expect(only.length).toBeGreaterThan(0);
    expect(only[0].reasonData.callCount).toBe(2);
  });

  it("aynı çağrıyı iki kez seçmez", () => {
    const week = Array.from({ length: 10 }, (_, i) => ev({ id: `w${i}`, score: 90 - i * 5 }));
    const history = Array.from({ length: 6 }, (_, i) => ev({ id: `h${i}`, score: 80 }));
    const ids = build(week, history).picks.map((p) => p.evaluationId);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("çok çağrıda seçiciden en fazla üç, artı pozitif garantisiyle en fazla dört satır verir", () => {
    const week = Array.from({ length: 20 }, (_, i) =>
      ev({ id: `w${i}`, score: 90 - i * 3, reportData: { passedCriteria: [{ id: "A1", label: "Kimlik", evidence: [{ speaker: "Danışman", timestamp: "00:05", text: "Merhaba" }] }] } })
    );
    const history = Array.from({ length: 6 }, (_, i) => ev({ id: `h${i}`, score: 80 }));
    const b = build(week, history);
    expect(b.picks.length).toBeGreaterThanOrEqual(3);
    expect(b.picks.length).toBeLessThanOrEqual(4);
  });

  it("hepsi negatifse pozitif garantisi bir satır ekler", () => {
    const good = { passedCriteria: [{ id: "A1", label: "Kimlik", evidence: [{ speaker: "Danışman", timestamp: "00:05", text: "Merhaba" }] }] };
    const week = Array.from({ length: 8 }, (_, i) => ev({ id: `w${i}`, score: 40 + i, reportData: good }));
    const history = Array.from({ length: 6 }, (_, i) => ev({ id: `h${i}`, score: 80 }));
    const b = build(week, history);
    expect(b.picks.some((p) => p.reason === "GOOD_EXAMPLE" || p.reason === "STANDOUT_UP")).toBe(true);
  });

  it("üç seçici de dolduğunda ve içinde pozitif varsa dördüncü satır eklenmez", () => {
    // C3 geçmişte 6 kez zayıf → RECURRING_WEAKNESS ateşlenir.
    const c3 = [{ id: "C3", label: "Kapanış", score: 40 }];
    const history = Array.from({ length: 6 }, (_, i) => ev({ id: `h${i}`, score: 70, weakCriteria: c3 }));
    const week = [
      ev({ id: "w1", score: 98 }),                                                  // STANDOUT_UP (+28)
      ev({ id: "w2", score: 40, weakCriteria: [{ id: "C3", label: "Kapanış", score: 20 }] }), // RECURRING
      ev({ id: "w3", score: 55 }),                                                  // BIGGEST_LOSS
      ev({ id: "w4", score: 60 }),
      ev({ id: "w5", score: 62 }),
    ];
    const b = build(week, history);
    expect(b.picks.map((p) => p.reason)).toEqual([
      "RECURRING_WEAKNESS",
      "BIGGEST_LOSS",
      "STANDOUT_UP",
    ]);
    expect(b.picks.map((p) => p.evaluationId)).toEqual(["w2", "w3", "w1"]);
    expect(b.picks).toHaveLength(3);
  });

  it("reportData null olan eski kayıtlarda çökmez", () => {
    const week = Array.from({ length: 6 }, (_, i) => ev({ id: `w${i}`, score: 70 - i, reportData: null, weakCriteria: null }));
    const b = build(week, week);
    expect(b.picks.length).toBeGreaterThan(0);
    expect(b.picks[0].evidence).toEqual([]);
  });

  it("puanlanamayan çağrıyı hiç seçmez ve sayıya katmaz", () => {
    // Telesekreter/yanlış numara: reportJson.ts bunu score 0 ve scorable:false
    // ile kaydediyor. Elenmezse kayıp 100 ile BIGGEST_LOSS'u kesin kazanır.
    const junk = ev({ id: "junk", score: 0, reportData: { scorable: false } });
    const b = build([junk, ev({ id: "w1", score: 80 }), ev({ id: "w2", score: 90 })]);
    expect(b.picks.map((p) => p.evaluationId)).not.toContain("junk");
    expect(b.callCount).toBe(2);
    // Ortalama yalnızca kalan ikiden: (80 + 90) / 2 = 85
    expect(b.averageScore).toBe(85);
  });

  it("puanlanamayan çağrı geçmiş ortalamasını da bozmaz", () => {
    // history: 3 × 70 puanlanabilir + 1 × 0 puanlanamaz.
    //   elenince  → n=3, ortalama 70    → w2 (85) sapması +15
    //   elenmezse → n=4, ortalama 52.5  → w2 (85) sapması +32.5
    // BIGGEST_LOSS w1'i alıyor, STANDOUT w2'ye düşüyor; ortalama iki halde de
    // farklı olduğu için bu iddia gerçekten ayırt ediyor.
    const history = [
      ev({ id: "h1", score: 70 }),
      ev({ id: "h2", score: 70 }),
      ev({ id: "h3", score: 70 }),
      ev({ id: "hjunk", score: 0, reportData: { scorable: false } }),
    ];
    const b = build([ev({ id: "w1", score: 70 }), ev({ id: "w2", score: 85 })], history);
    const standout = b.picks.find((p) => p.reason === "STANDOUT_UP");
    expect(standout?.evaluationId).toBe("w2");
    expect(standout?.reasonData).toMatchObject({ average: 70, deviation: 15 });
  });

  it("lang'i kanıt çıkarmaya kadar geçirir", () => {
    const b = buildBriefing({
      agentId: "a1", agentName: "Ayşe Yıldız", windowWeeks: 4, lang: "en",
      week: [ev({ id: "w1", score: 60, reportData: blockBilingual })],
      history: [],
    });
    expect(b.picks[0].criterionLabel).toBe("Closing Discipline");
    expect(b.picks[0].shouldHaveSaid).toBe("I will call you tomorrow at 2 pm.");
  });

  it("her satır müşteri adı, tarih ve skoru taşır", () => {
    const b = build([ev({ id: "w1", customerName: "Mehmet Kaya", callDate: "2026-09-15T09:00:00.000Z", score: 66 })]);
    expect(b.picks[0]).toMatchObject({
      customerName: "Mehmet Kaya",
      callDate: "2026-09-15T09:00:00.000Z",
      score: 66,
    });
  });
});
