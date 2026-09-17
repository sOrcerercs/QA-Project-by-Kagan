import { describe, it, expect } from "vitest";
import {
  evaluationLoss,
  selectRecurringWeakness,
  selectBiggestLoss,
  selectStandout,
  pickEvidence,
  buildBriefing,
  type BriefingEval,
  type CriterionStat,
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


/**
 * Fixture adaptörü. Geçmiş penceresi artık `CriterionStat[]` olarak geliyor
 * (SQL'de özetleniyor, bkz. route). Bu yardımcı eski fixture dizilerini o
 * şekle çevirir ki testler okunur kalsın. SQL'in kendi doğruluğu
 * app/api/reports/coaching-briefing/route.test.ts'te sınanır.
 */
function statsOf(history: BriefingEval[]): CriterionStat[] {
  const m = new Map<string, { label: string; n: number; total: number }>();
  for (const e of history) {
    const rows = Array.isArray(e.weakCriteria) ? e.weakCriteria : [];
    for (const raw of rows as Array<Record<string, unknown>>) {
      if (!raw || typeof raw.id !== "string") continue;
      const label = typeof raw.label === "string" ? raw.label : raw.id;
      const score = typeof raw.score === "number" ? raw.score : 0;
      const c = m.get(raw.id) ?? { label, n: 0, total: 0 };
      c.n += 1;
      c.total += score;
      m.set(raw.id, c);
    }
  }
  return [...m.entries()].map(([criterionId, c]) => ({
    criterionId, label: c.label, occurrences: c.n, avgScore: c.total / c.n,
  }));
}

const scoresOf = (history: BriefingEval[]) => history.map((e) => e.score);

describe("evaluationLoss", () => {
  it("skordan türetir — blok varken bile bloğa bakmaz", () => {
    const e = ev({
      score: 70,
      reportData: {
        weakCriteria: [
          { id: "A3", label: "Medikal Profil", loss: 0.75, weight: 1.5 },
          { id: "C3", label: "Kapanış", loss: 2.25, weight: 3 },
        ],
      },
    });
    // Blok okunmuyor: kayıp 100 − 70. Bloktan türetilen değer (66.7) ile
    // aradaki fark ÖLÇÜLDÜ ve kayıtların %98.3'ünde yuvarlama içinde kalıyor;
    // bu fixture kasten ayrışan uçlardan biri, davranışın bloğa bakmadığını
    // göstermek için duruyor.
    expect(evaluationLoss(e)).toBe(30);
  });

  it("skor 100'de sıfır döner — blok kayıp iddia etse bile", () => {
    // Ölçümde ayrışan 6 kaydın hepsi buydu: blok yolu N/A maddelerini kayıp
    // sayıp %15-28 gösteriyordu. Kusursuz çağrıda doğru cevap 0.
    const e = ev({
      score: 100,
      reportData: { weakCriteria: [{ id: "A3", label: "Medikal", earned: 0, weight: 1.5 }] },
    });
    expect(evaluationLoss(e)).toBe(0);
  });

  it("blok yoksa da aynı hesap", () => {
    expect(evaluationLoss(ev({ score: 62, reportData: null }))).toBe(38);
  });

  it("eski weakCriteria kolonu sonucu değiştirmez", () => {
    const e = ev({
      score: 62,
      reportData: null,
      weakCriteria: [{ id: "A3", label: "Medikal", earned: 0.5, weight: 1.5 }],
    });
    expect(evaluationLoss(e)).toBe(38);
  });

  it("negatif sonuç üretmez", () => {
    expect(evaluationLoss(ev({ score: 120 }))).toBe(0);
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
    const out = selectRecurringWeakness(week, statsOf(history), 4);
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
    expect(selectRecurringWeakness(week, statsOf(history), 4)).toEqual([]);
  });

  it("tekrar eden kriter o hafta hiç geçmiyorsa boş döner", () => {
    const history = [
      ev({ id: "h1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 40 }]) }),
      ev({ id: "h2", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 45 }]) }),
    ];
    const week = [ev({ id: "w1", weakCriteria: wc([{ id: "A1", label: "Selamlama", score: 50 }]) })];
    expect(selectRecurringWeakness(week, statsOf(history), 4)).toEqual([]);
  });

  it("weakCriteria boş ya da dizi değilse çökmez", () => {
    const history = [ev({ id: "h1", weakCriteria: null }), ev({ id: "h2", weakCriteria: "bozuk" })];
    const week = [ev({ id: "w1", weakCriteria: undefined })];
    expect(selectRecurringWeakness(week, statsOf(history), 4)).toEqual([]);
  });

  it("beraberlikte ortalama kriter skoru düşük olanı seçer", () => {
    const history = [
      ev({ id: "h1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 70 }, { id: "A1", label: "Selamlama", score: 20 }]) }),
      ev({ id: "h2", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 70 }, { id: "A1", label: "Selamlama", score: 30 }]) }),
    ];
    const week = [
      ev({ id: "w1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 65 }, { id: "A1", label: "Selamlama", score: 25 }]) }),
    ];
    const out = selectRecurringWeakness(week, statsOf(history), 4);
    expect(out[0].reasonData.criterionId).toBe("A1");
  });

  it("eşit kriter skorunda id'ye göre belirlenimci sıralar", () => {
    const history = [
      ev({ id: "h1", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 40 }]) }),
      ev({ id: "h2", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 45 }]) }),
    ];
    const wA = ev({ id: "wA", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 30 }]) });
    const wB = ev({ id: "wB", weakCriteria: wc([{ id: "C3", label: "Kapanış", score: 30 }]) });
    const first = selectRecurringWeakness([wB, wA], statsOf(history), 4);
    const second = selectRecurringWeakness([wA, wB], statsOf(history), 4);
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
    const out = selectStandout(week, scoresOf(history));
    expect(out[0].reason).toBe("STANDOUT_UP");
    expect(out[0].reasonData).toMatchObject({ deviation: 18, average: 70 });
  });

  it("aşağı sapmayı STANDOUT_DOWN olarak işaretler", () => {
    const week = [ev({ id: "w1", score: 50 })];
    const out = selectStandout(week, scoresOf(history));
    expect(out[0].reason).toBe("STANDOUT_DOWN");
    expect(out[0].reasonData.deviation).toBe(-20);
  });

  it("mutlak sapması büyük olanı öne alır", () => {
    const week = [ev({ id: "w1", score: 78 }), ev({ id: "w2", score: 45 })];
    expect(selectStandout(week, scoresOf(history)).map((c) => c.evaluationId)).toEqual(["w2", "w1"]);
  });

  it("eşik altındaki sapmaları eler", () => {
    const week = [ev({ id: "w1", score: 73 })];
    expect(selectStandout(week, scoresOf(history))).toEqual([]);
  });

  it("geçmiş üç değerlendirmeden azsa ortalamaya güvenmez", () => {
    const week = [ev({ id: "w1", score: 95 })];
    expect(selectStandout(week, [60, 60])).toEqual([]);
  });

  it("hepsi aynı skorsa boş döner", () => {
    const week = [ev({ id: "w1", score: 70 })];
    expect(selectStandout(week, scoresOf(history))).toEqual([]);
  });

  it("eşit mutlak sapmada id'ye göre belirlenimci sıralar", () => {
    // 85 (+15) ve 55 (-15): mutlak sapma eşit, yön farklı.
    const a = selectStandout([ev({ id: "wB", score: 85 }), ev({ id: "wA", score: 55 })], scoresOf(history));
    const b = selectStandout([ev({ id: "wA", score: 55 }), ev({ id: "wB", score: 85 })], scoresOf(history));
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

  it("kayıp bilinmiyorsa alfabetik ilkini değil en kötü kriteri etiketler", () => {
    // Eski kayıtlarda madde ağırlığı yok → toFault loss: null, altScore: score.
    // buildReportCard bunları altScore ARTAN sıralıyor, yani C3 (20) önce.
    // Eskiden pickEvidence null kaybı 0'a çekip id alfabetiğine düşüyordu
    // ve "Selamlama" (A1) etiketleniyordu.
    const d = pickEvidence(
      ev({
        reportData: {
          weakCriteria: [
            { id: "A1", label: "Selamlama", score: 80 },
            { id: "C3", label: "Kapanış", score: 20 },
          ],
        },
      }),
      "BIGGEST_LOSS",
      {}
    );
    expect(d.criterionLabel).toBe("Kapanış");
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
  buildBriefing({
    agentId: "a1", agentName: "Ayşe Yıldız", week,
    history: statsOf(history), historyScores: scoresOf(history), windowWeeks: 4,
  });

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
    // w0..w9 skorları 90, 85, …, 45; geçmiş 6 × 80 → ortalama 80.
    //   kayıp (blok yok → 100 − skor): w9 en büyük (55) → BIGGEST_LOSS w9
    //   sapma: w9 −35 (en büyük mutlak) ama w9 KULLANILDI → sıradaki w8 (−30)
    //   pozitif garantisi: reportData null → hiçbir çağrıda kanıt yok, düşer
    //   az çağrı hâli: 10 > 3 → çalışmaz
    // Dedupsuz olsaydı w9 iki kez gelirdi; tam eşitlik bunu sabitliyor.
    const week = Array.from({ length: 10 }, (_, i) => ev({ id: `w${i}`, score: 90 - i * 5 }));
    const history = Array.from({ length: 6 }, (_, i) => ev({ id: `h${i}`, score: 80 }));
    const b = build(week, history);
    expect(b.picks.map((p) => p.reason)).toEqual(["BIGGEST_LOSS", "STANDOUT_DOWN"]);
    expect(b.picks.map((p) => p.evaluationId)).toEqual(["w9", "w8"]);
    expect(b.picks).toHaveLength(2);
  });

  it("üç seçici de ateşlenip hiçbiri pozitif değilse dördüncü satır eklenir", () => {
    // Geçmiş: 4 × skor 70, hepsinde C3 zayıf → ortalama 70, C3 occurrences 4.
    // Hafta (hepsinde iyi örnek kanıtı olan blok, ağırlık yok → kayıp = 100 − skor):
    //   w1 45 · C3 skor 10   w2 50 · C3 skor 30   w3 40   w4 55   w5 72
    //
    //   RECURRING  (C3, hafta içi kriter skoru artan): w1(10), w2(30)  → w1
    //   BIGGEST_LOSS (kayıp azalan): w3 60, w1 55, w2 50, w4 45, w5 28 → w3
    //   STANDOUT (|sapma| azalan, eşik 5): w3 −30, w1 −25, w2 −20, w4 −15
    //     (w5 +2 eşiğin altında)                                       → w2
    //   üçü de negatif → pozitif garantisi: kalanlar w4(55), w5(72),
    //     skor azalan                                                  → w5
    //   az çağrı hâli: 5 > 3 → çalışmaz
    const good = {
      passedCriteria: [
        { id: "A1", label: "Kimlik", evidence: [{ speaker: "Danışman", timestamp: "00:05", text: "Merhaba" }] },
      ],
    };
    const c3 = (score: number) => [{ id: "C3", label: "Kapanış", score }];
    const history = Array.from({ length: 4 }, (_, i) =>
      ev({ id: `h${i}`, score: 70, weakCriteria: c3(40) })
    );
    const week = [
      ev({ id: "w1", score: 45, reportData: good, weakCriteria: c3(10) }),
      ev({ id: "w2", score: 50, reportData: good, weakCriteria: c3(30) }),
      ev({ id: "w3", score: 40, reportData: good }),
      ev({ id: "w4", score: 55, reportData: good }),
      ev({ id: "w5", score: 72, reportData: good }),
    ];
    const b = build(week, history);
    expect(b.picks.map((p) => p.reason)).toEqual([
      "RECURRING_WEAKNESS",
      "BIGGEST_LOSS",
      "STANDOUT_DOWN",
      "GOOD_EXAMPLE",
    ]);
    expect(b.picks.map((p) => p.evaluationId)).toEqual(["w1", "w3", "w2", "w5"]);
    expect(b.picks).toHaveLength(4);
    expect(b.picks[0].reasonData).toMatchObject({
      criterionId: "C3", criterionLabel: "Kapanış", occurrences: 4, windowWeeks: 4,
    });
    expect(b.picks[1].reasonData.loss).toBe(60);
    expect(b.picks[2].reasonData).toMatchObject({ deviation: -20, average: 70 });
  });

  it("hepsi negatifse pozitif garantisi tam bir satır ekler", () => {
    // w0..w7 skorları 40..47, hepsinde iyi örnek kanıtı; geçmiş 6 × 80.
    //   RECURRING: geçmişte hiç weakCriteria yok                    → düşer
    //   BIGGEST_LOSS: kayıp 60, 59, …, 53 → en büyüğü w0            → w0
    //   STANDOUT: sapma −40 … −33, hepsi eşiğin üstünde; w0 kullanıldı → w1
    //   pozitif yok → garanti: kalanlar w2..w7, skor azalan          → w7 (47)
    const good = { passedCriteria: [{ id: "A1", label: "Kimlik", evidence: [{ speaker: "Danışman", timestamp: "00:05", text: "Merhaba" }] }] };
    const week = Array.from({ length: 8 }, (_, i) => ev({ id: `w${i}`, score: 40 + i, reportData: good }));
    const history = Array.from({ length: 6 }, (_, i) => ev({ id: `h${i}`, score: 80 }));
    const b = build(week, history);
    expect(b.picks.map((p) => p.reason)).toEqual(["BIGGEST_LOSS", "STANDOUT_DOWN", "GOOD_EXAMPLE"]);
    expect(b.picks.map((p) => p.evaluationId)).toEqual(["w0", "w1", "w7"]);
    expect(b.picks).toHaveLength(3);
    // Pozitif satır kanıtlı gelir — kanıtsız "iyi örnek" gösterilmez.
    expect(b.picks[2].evidence).toEqual([{ speakerLabel: "Danışman", ts: "00:05", text: "Merhaba" }]);
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

  // NOT: puanlanamayan çağrıların (telesekreter, yanlış numara) elenmesi artık
  // BURADA test edilmiyor — eleme SQL'e taşındı, çünkü burada elemek her satır
  // için blok okumayı gerektiriyordu ve blok okumak pahalı (1149 satır 68 sn).
  // Karşılığı: app/api/reports/coaching-briefing/route.test.ts.

  it("lang'i kanıt çıkarmaya kadar geçirir", () => {
    const b = buildBriefing({
      agentId: "a1", agentName: "Ayşe Yıldız", windowWeeks: 4, lang: "en",
      history: [], historyScores: [],
      week: [ev({ id: "w1", score: 60, reportData: blockBilingual })],
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
