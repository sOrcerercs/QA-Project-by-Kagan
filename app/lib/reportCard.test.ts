import { describe, it, expect } from "vitest";
import { buildReportCard, scoreBand } from "./reportCard";

/** First Call v11.3'ün gerçekten ürettiği blok. */
const v113 = {
  promptVersion: "v11.3",
  callClassification: "CONNECTED_QUALIFIED",
  overallScore: 58,
  hardFail: false,
  scorable: true,
  sectionScores: { A: 75, B: 50, C: 50 },
  passedCriteria: [
    {
      id: "A1",
      label: "Kimlik, Marka ve İzin",
      earned: 3.0,
      weight: 3.0,
      summary: "Dört adım da tam.",
      subChecks: [{ label: "İsim", ok: true }],
      evidence: [{ speaker: "Danışman", timestamp: "00:11", text: "This is Billy from Estenove." }],
    },
    { id: "C2", label: "Köprü", earned: 3.0, weight: 3.0 },
  ],
  weakCriteria: [
    {
      id: "A3", label: "Medikal Profil", verdict: "PARTIAL", loss: 0.75, weight: 1.5, score: 50,
      whatHappened: "Takip sorusu sorulmadı.",
      subChecks: [{ label: "Türkiye", ok: false }],
      evidence: [{ speaker: "Danışman", timestamp: "00:54", text: "Okay. Perfect." }],
      shouldHaveSaid: "Was it done in Turkey?",
      coachingNote: "Takip sorusunu sor.",
    },
    {
      id: "C3", label: "Kapanış Disiplini", verdict: "FAIL", loss: 3.0, weight: 3.0, score: 0,
      whatHappened: "Kapanışta saat tekrarlanmadı.",
      evidence: [{ speaker: "Danışman", timestamp: "03:34", text: "Have a great day." }],
      shouldHaveSaid: "Konsültasyonunuzu 16:00'a ayarladım.",
      coachingNote: "Saati tekrarla.",
    },
  ],
  naCriteria: [{ id: "B1", label: "Doktor Odaklı Otorite", reason: "Doktor rolüne dair soru gelmedi" }],
};

describe("v11.3 bloğu — promptun kendi alan adlarıyla", () => {
  const card = buildReportCard({ reportData: v113 });

  it("passedCriteria / weakCriteria / naCriteria adlarını tanır", () => {
    expect(card.passed.map((p) => p.id)).toEqual(["A1", "C2"]);
    expect(card.faults.map((f) => f.id)).toEqual(["C3", "A3"]);
    expect(card.na.map((n) => n.id)).toEqual(["B1"]);
  });

  it("etiketi bloktan alır — kodda kriter sözlüğü yok", () => {
    expect(card.faults[0].label).toBe("Kapanış Disiplini");
    expect(card.na[0].label).toBe("Doktor Odaklı Otorite");
  });

  it("weight'i max, timestamp'i ts, subChecks'i subs olarak okur", () => {
    expect(card.passed[0].max).toBe(3);
    expect(card.passed[0].evidence[0].ts).toBe("00:11");
    expect(card.passed[0].subs).toEqual([{ label: "İsim", ok: true }]);
  });

  it("promptun verdiği loss'u kullanır", () => {
    expect(card.faults.find((f) => f.id === "A3")!.loss).toBe(0.75);
  });

  it("verdict'ten şiddeti türetir", () => {
    expect(card.faults.find((f) => f.id === "C3")!.severity).toBe("broken");
    expect(card.faults.find((f) => f.id === "A3")!.severity).toBe("partial");
  });

  it("kırılanları kayba göre sıralar", () => {
    expect(card.faults.map((f) => f.loss)).toEqual([3, 0.75]);
  });

  it("bölüm ölçerlerini sectionScores'tan üretir", () => {
    expect(card.sections).toEqual([
      { key: "A", label: null, score: 75 },
      { key: "B", label: null, score: 50 },
      { key: "C", label: null, score: 50 },
    ]);
  });

  it("ham puanı earned/weight toplamından hesaplar", () => {
    expect(card.points).toEqual({ earned: 6.75, max: 10.5 });
  });

  it("scorable/hardFail bayraklarını taşır", () => {
    expect(card.scorable).toBe(true);
    expect(card.hardFail).toBe(false);
  });
});

describe("prompt değişse de kod değişmez", () => {
  it("hiç tanımadığı kriter id'lerini olduğu gibi gösterir", () => {
    const card = buildReportCard({
      reportData: {
        weakCriteria: [
          { id: "B13", label: "İtinerary", score: 40, coachingNote: "3 günlük akışı anlat." },
          { id: "C6", label: "Dinamik Takip & Follow-up Hunter", score: 20, coachingNote: "Template gönder." },
        ],
      },
    });
    expect(card.faults.map((f) => f.label)).toEqual([
      "Dinamik Takip & Follow-up Hunter",
      "İtinerary",
    ]);
  });

  it("yeni bir bölüm (D) eklenirse ölçer kendiliğinden çıkar", () => {
    const card = buildReportCard({ reportData: { sectionScores: { A: 80, B: 60, C: 70, D: 55 } } });
    expect(card.sections.map((s) => s.key)).toEqual(["A", "B", "C", "D"]);
  });

  it("bölüm adı bloktan gelirse onu kullanır", () => {
    const card = buildReportCard({
      reportData: { sections: [{ key: "A", label: "Giriş & Profil", score: 75 }] },
    });
    expect(card.sections[0].label).toBe("Giriş & Profil");
  });

  it("bant metnini bloktan alır — eşikler kodda sabit değil", () => {
    const card = buildReportCard({ reportData: { band: "Coaching Required", sectionScores: { A: 1 } } });
    expect(card.band).toBe("Coaching Required");
  });

  it("tanımadığı fazladan alanlar hata vermez", () => {
    const card = buildReportCard({
      reportData: { yepyeniAlan: { derin: [1, 2] }, weakCriteria: [{ id: "A1", score: 10 }] },
    });
    expect(card.faults).toHaveLength(1);
  });
});

describe("v11.3 özel durumları", () => {
  it("scorable:false — puanlanamayan arama", () => {
    const card = buildReportCard({
      reportData: {
        scorable: false,
        callClassification: "VOICEMAIL",
        overallScore: null,
        sectionScores: { A: null, B: null, C: null },
        weakCriteria: [],
      },
    });
    expect(card.scorable).toBe(false);
    expect(card.classification).toBe("VOICEMAIL");
    expect(card.sections).toEqual([]);
  });

  it("null bölüm skoru ölçer çizmez, dolu olanlar kalır", () => {
    const card = buildReportCard({ reportData: { sectionScores: { A: 71, B: null, C: 67 } } });
    expect(card.sections.map((s) => s.key)).toEqual(["A", "C"]);
  });

  it("hardFail bayrağı taşınır", () => {
    const card = buildReportCard({ reportData: { hardFail: true, sectionScores: { A: 70 } } });
    expect(card.hardFail).toBe(true);
  });
});

describe("İngilizce", () => {
  it("blok labelEn verirse canlı çeviriye gerek kalmaz", () => {
    const card = buildReportCard({
      reportData: { weakCriteria: [{ id: "C3", label: "Kapanış Disiplini", labelEn: "Closing Discipline", score: 0 }] },
      lang: "en",
    });
    expect(card.faults[0].label).toBe("Closing Discipline");
  });

  it("labelEn yoksa Türkçe etikete düşer (çeviri servisi devreye girer)", () => {
    const card = buildReportCard({
      reportData: { weakCriteria: [{ id: "C3", label: "Kapanış Disiplini", score: 0 }] },
      lang: "en",
    });
    expect(card.faults[0].label).toBe("Kapanış Disiplini");
  });
});

describe("kanıt ve highlight", () => {
  it("highlight yalnızca alıntının birebir alt dizesiyse kabul edilir", () => {
    const card = buildReportCard({
      reportData: {
        weakCriteria: [{ id: "A1", score: 0, evidence: [{ speaker: "Danışman", text: "Hello there", highlight: ["Hello", "Merhaba"] }] }],
      },
    });
    expect(card.faults[0].evidence[0].highlights).toEqual(["Hello"]);
  });

  it("konuşmacıyı iki dilde de tanır, tanımadığını olduğu gibi taşır", () => {
    const card = buildReportCard({
      reportData: {
        weakCriteria: [{
          id: "A1", score: 0,
          evidence: [
            { speaker: "Danışman", text: "a" },
            { speaker: "Customer", text: "b" },
            { speaker: "Operatör", text: "c" },
          ],
        }],
      },
    });
    expect(card.faults[0].evidence.map((e) => e.speaker)).toEqual(["agent", "customer", "other"]);
    expect(card.faults[0].evidence[2].speakerLabel).toBe("Operatör");
  });

  it("metni olmayan kanıtı atar", () => {
    const card = buildReportCard({
      reportData: { weakCriteria: [{ id: "A1", score: 0, evidence: [{ speaker: "Danışman", text: "  " }] }] },
    });
    expect(card.faults[0].evidence).toHaveLength(0);
  });
});

describe("eski kayıtlar (blok yok)", () => {
  const legacy = [
    { id: "C3", label: "Kapanış", score: 30, coachingNote: "Saati tekrarla." },
    { id: "B2", label: "Fiyat", score: 70, coachingNote: "Kapsamı say." },
  ];

  it("ayrı kolonlardan kart üretir", () => {
    const card = buildReportCard({ weakCriteria: legacy, sectionScores: { A: 80, B: 60, C: 70 } });
    expect(card.faults.map((f) => f.id)).toEqual(["C3", "B2"]);
    expect(card.sections).toHaveLength(3);
    expect(card.isSparse).toBe(true);
    expect(card.points).toBeNull();
  });

  it("kayıp hesaplanamaz, kriter skoru gösterilir", () => {
    const card = buildReportCard({ weakCriteria: legacy });
    expect(card.faults[0].loss).toBeNull();
    expect(card.faults[0].altScore).toBe(30);
    expect(card.faults[0].whatHappened).toBe("Saati tekrarla.");
  });

  it("blok doluysa eski kolon yok sayılır", () => {
    const card = buildReportCard({
      reportData: { weakCriteria: [{ id: "A1", label: "Yeni", score: 0 }] },
      weakCriteria: legacy,
    });
    expect(card.faults.map((f) => f.id)).toEqual(["A1"]);
  });
});

describe("bozuk veri", () => {
  it("hiç veri yoksa boş kart", () => {
    const card = buildReportCard({});
    expect(card.isEmpty).toBe(true);
  });

  it("null / string / sayı girdilerinde patlamaz", () => {
    for (const bad of [null, undefined, "{}", 42, [], { weakCriteria: "nope" }]) {
      expect(() => buildReportCard({ reportData: bad, weakCriteria: bad, sectionScores: bad })).not.toThrow();
    }
  });

  it("id'si olmayan maddeyi atar", () => {
    const card = buildReportCard({ reportData: { weakCriteria: [{ score: 0 }, { id: "A1", score: 0 }] } });
    expect(card.faults).toHaveLength(1);
  });

  it("sayı string olarak gelirse yine okur", () => {
    const card = buildReportCard({ reportData: { weakCriteria: [{ id: "A1", earned: "0.5", weight: "2.0" }] } });
    expect(card.faults[0].loss).toBe(1.5);
  });
});

describe("scoreBand — yalnızca blok band vermediğinde yedek", () => {
  it("eşikler promptun BANDS tablosuyla aynı", () => {
    expect(scoreBand(92, "tr")).toBe("Güçlü");
    expect(scoreBand(70, "en")).toBe("Acceptable");
    expect(scoreBand(58, "en")).toBe("Coaching Required");
    expect(scoreBand(54, "en")).toBe("Critical");
  });
});

describe("markdown kalın işaretleri", () => {
  it("kanıt alıntısındaki ** işaretlerini ayıklar ve highlight'a çevirir", () => {
    const card = buildReportCard({
      reportData: {
        passedCriteria: [{
          id: "A1",
          evidence: [{ speaker: "Danışman", text: "This is Ella from **Estenowe Hair Transplant Clinic** in Istanbul." }],
        }],
      },
    });
    const ev = card.passed[0].evidence[0];
    expect(ev.text).toBe("This is Ella from Estenowe Hair Transplant Clinic in Istanbul.");
    expect(ev.highlights).toEqual(["Estenowe Hair Transplant Clinic"]);
  });

  it("birden fazla kalın parçayı da alır", () => {
    const card = buildReportCard({
      reportData: { passedCriteria: [{ id: "A1", evidence: [{ text: "**Billy** from **Estenove**" }] }] },
    });
    expect(card.passed[0].evidence[0].highlights).toEqual(["Billy", "Estenove"]);
    expect(card.passed[0].evidence[0].text).toBe("Billy from Estenove");
  });

  it("ayrı highlight alanıyla birleşir, tekrarı düşürür", () => {
    const card = buildReportCard({
      reportData: {
        passedCriteria: [{ id: "A1", evidence: [{ text: "**Billy** said hello", highlight: ["Billy", "hello"] }] }],
      },
    });
    expect(card.passed[0].evidence[0].highlights).toEqual(["Billy", "hello"]);
  });

  it("yıldız yoksa metne dokunmaz", () => {
    const card = buildReportCard({
      reportData: { passedCriteria: [{ id: "A1", evidence: [{ text: "Plain quote" }] }] },
    });
    expect(card.passed[0].evidence[0].text).toBe("Plain quote");
    expect(card.passed[0].evidence[0].highlights).toEqual([]);
  });
});
