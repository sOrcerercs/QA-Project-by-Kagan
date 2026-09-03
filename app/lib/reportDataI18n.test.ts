import { describe, it, expect } from "vitest";
import { collectTranslatable, applyTranslations } from "./reportDataI18n";
import { buildReportCard } from "./reportCard";

const sample = {
  promptVersion: "v11.3",
  callClassification: "CONNECTED_QUALIFIED",
  scorable: true,
  overallScore: 58,
  sectionScores: { A: 75, B: 50, C: 50 },
  passedCriteria: [
    {
      id: "A1",
      label: "Kimlik, Marka ve İzin",
      earned: 3,
      weight: 3,
      summary: "Dört adım da tam.",
      subChecks: [{ label: "İsim", ok: true }],
      evidence: [{ speaker: "Danışman", timestamp: "00:01", text: "This is Billy from Estenove.", highlight: ["Billy"] }],
    },
  ],
  weakCriteria: [
    {
      id: "C3",
      label: "Kapanış Disiplini",
      verdict: "FAIL",
      loss: 3,
      weight: 3,
      whatHappened: "Kapanışta saat tekrarlanmadı.",
      shouldHaveSaid: "Konsültasyonunuzu 16:00'a ayarladım.",
      evidence: [{ speaker: "Danışman", text: "Have a great day.", note: "→ takip sorusu yok" }],
      coachingNote: "Saati tekrarla.",
    },
  ],
  naCriteria: [{ id: "A5", label: "Empati", reason: "müşteri endişe belirtmedi" }],
};

describe("collectTranslatable", () => {
  const texts = collectTranslatable(sample);

  it("modelin yazdığı serbest metinleri toplar", () => {
    expect(texts).toContain("Dört adım da tam.");
    expect(texts).toContain("Kapanışta saat tekrarlanmadı.");
    expect(texts).toContain("Konsültasyonunuzu 16:00'a ayarladım.");
    expect(texts).toContain("→ takip sorusu yok");
    expect(texts).toContain("müşteri endişe belirtmedi");
    expect(texts).toContain("Kimlik, Marka ve İzin");
    expect(texts).toContain("İsim");
  });

  it("kanıt alıntısını ve highlight'ı ASLA göndermez", () => {
    expect(texts).not.toContain("This is Billy from Estenove.");
    expect(texts).not.toContain("Have a great day.");
    expect(texts).not.toContain("Billy");
  });

  it("makine değerlerini göndermez", () => {
    for (const machine of ["A1", "C3", "v11.3", "CONNECTED_QUALIFIED", "FAIL", "00:01"]) {
      expect(texts).not.toContain(machine);
    }
  });

  it("veri yoksa boş dizi", () => {
    expect(collectTranslatable(null)).toEqual([]);
    expect(collectTranslatable("nope")).toEqual([]);
    expect(collectTranslatable({})).toEqual([]);
  });
});

describe("prompt değişse de çeviri kendiliğinden kapsar", () => {
  it("bloğa eklenen yepyeni metin alanı kod değişmeden çeviriye girer", () => {
    const texts = collectTranslatable({
      weakCriteria: [{ id: "A1", label: "X", gelecektekiYeniAlan: "Bu alan bugün yok ama yarın eklenebilir." }],
    });
    expect(texts).toContain("Bu alan bugün yok ama yarın eklenebilir.");
  });

  it("bloğa eklenen yepyeni bölüm de kapsanır", () => {
    const texts = collectTranslatable({
      yeniBolum: [{ baslik: "Yeni başlık", aciklama: "Yeni açıklama" }],
    });
    expect(texts).toEqual(["Yeni başlık", "Yeni açıklama"]);
  });

  it("prompt hazır İngilizce verirse aynı metin iki kez çevrilmez", () => {
    const texts = collectTranslatable({
      weakCriteria: [{ id: "A1", label: "Kapanış", labelEn: "Closing", whatHappened: "Olan şey." }],
    });
    expect(texts).toEqual(["Olan şey."]);
  });
});

describe("applyTranslations", () => {
  it("çevirileri doğru alanlara yerleştirir", () => {
    const texts = collectTranslatable(sample);
    const out = applyTranslations(sample, texts.map((t) => `EN:${t}`)) as typeof sample;

    expect(out.weakCriteria[0].whatHappened).toBe("EN:Kapanışta saat tekrarlanmadı.");
    expect(out.naCriteria[0].reason).toBe("EN:müşteri endişe belirtmedi");
    expect(out.passedCriteria[0].subChecks[0].label).toBe("EN:İsim");
  });

  it("alıntıya, highlight'a, id'ye ve sayılara dokunmaz", () => {
    const texts = collectTranslatable(sample);
    const out = applyTranslations(sample, texts.map((t) => `EN:${t}`)) as typeof sample;

    expect(out.passedCriteria[0].evidence[0].text).toBe("This is Billy from Estenove.");
    expect(out.passedCriteria[0].evidence[0].highlight).toEqual(["Billy"]);
    expect(out.passedCriteria[0].evidence[0].timestamp).toBe("00:01");
    expect(out.weakCriteria[0].id).toBe("C3");
    expect(out.weakCriteria[0].loss).toBe(3);
    expect(out.sectionScores).toEqual({ A: 75, B: 50, C: 50 });
  });

  it("kaynağı değiştirmez", () => {
    const texts = collectTranslatable(sample);
    applyTranslations(sample, texts.map((t) => `EN:${t}`));
    expect(sample.weakCriteria[0].whatHappened).toBe("Kapanışta saat tekrarlanmadı.");
  });

  it("satır sayısı tutmuyorsa hiçbir şey uygulamaz", () => {
    expect(applyTranslations(sample, ["tek satır"])).toBe(sample);
    expect(applyTranslations(sample, null)).toBe(sample);
  });

  it("boş satırda o alanı orijinal bırakır", () => {
    const texts = collectTranslatable(sample);
    const partial = texts.map((t, i) => (i === 0 ? "  " : `EN:${t}`));
    const out = applyTranslations(sample, partial) as typeof sample;
    expect(out.passedCriteria[0].label).toBe("Kimlik, Marka ve İzin");
  });

  it("çevrilmiş veri karta sorunsuz girer, kanıt İngilizce kalır", () => {
    const texts = collectTranslatable(sample);
    const out = applyTranslations(sample, texts.map((t) => `EN:${t}`));
    const card = buildReportCard({ reportData: out, lang: "en" });

    expect(card.faults[0].whatHappened).toBe("EN:Kapanışta saat tekrarlanmadı.");
    expect(card.passed[0].evidence[0].text).toBe("This is Billy from Estenove.");
    expect(card.passed[0].evidence[0].highlights).toEqual(["Billy"]);
    expect(card.points).toEqual({ earned: 3, max: 6 });
  });
});
