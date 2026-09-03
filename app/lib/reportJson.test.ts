import { describe, it, expect } from "vitest";
import { extractReportJson, reportJsonFields, deriveScoreFromBlock } from "./reportJson";

const report = `📊 DEĞERLENDİRME
Genel Skor: 58

📝 Detay
• Bir şeyler

===JSON_DATA===
{
  "sectionScores": { "A": 75, "B": 50, "C": 50 },
  "weakCriteria": [{ "id": "C3", "label": "Kapanış", "score": 30, "coachingNote": "Saati tekrarla." }],
  "faults": [{ "id": "C3", "earned": 0, "max": 3 }],
  "coaching": [{ "title": "Kapanışta saati tekrarla" }]
}
===END_JSON===`;

describe("extractReportJson", () => {
  const out = extractReportJson(report);

  it("JSON bloğunu rapor metninden çıkarır", () => {
    expect(out.cleanReport).not.toContain("JSON_DATA");
    expect(out.cleanReport).not.toContain("faults");
    expect(out.cleanReport.startsWith("📊 DEĞERLENDİRME")).toBe(true);
  });

  it("skoru rapor metninden okur", () => {
    expect(out.score).toBe(58);
  });

  it("İngilizce skor başlığını da tanır", () => {
    expect(extractReportJson("Overall Score: 72\n").score).toBe(72);
  });

  it("eski alanları ayrıştırır", () => {
    expect(out.sectionScores).toEqual({ A: 75, B: 50, C: 50 });
    expect(out.weakCriteria).toHaveLength(1);
  });

  it("bloğun tamamını reportData olarak saklar", () => {
    expect(out.reportData).toMatchObject({
      faults: [{ id: "C3", earned: 0, max: 3 }],
      coaching: [{ title: "Kapanışta saati tekrarla" }],
    });
  });

  it("blok yoksa metni bozmadan döner", () => {
    const plain = extractReportJson("Genel Skor: 90\nSadece metin.");
    expect(plain.reportData).toBeNull();
    expect(plain.sectionScores).toBeNull();
    expect(plain.score).toBe(90);
    expect(plain.cleanReport).toBe("Genel Skor: 90\nSadece metin.");
  });

  it("bozuk JSON'da patlamaz, metni yine temizler", () => {
    const broken = extractReportJson("Genel Skor: 10\n===JSON_DATA===\n{ bozuk\n===END_JSON===");
    expect(broken.reportData).toBeNull();
    expect(broken.score).toBe(10);
    expect(broken.cleanReport).toBe("Genel Skor: 10");
  });

  it("skor satırı yoksa 0 verir", () => {
    expect(extractReportJson("başlıksız rapor").score).toBe(0);
  });

  it("string olmayan girdide patlamaz", () => {
    expect(() => extractReportJson(null as unknown as string)).not.toThrow();
    expect(extractReportJson(undefined as unknown as string).score).toBe(0);
  });

  it("blok dizi ise reportData'ya yazmaz", () => {
    const arr = extractReportJson("===JSON_DATA===\n[1,2,3]\n===END_JSON===");
    expect(arr.reportData).toBeNull();
  });
});

describe("reportJsonFields", () => {
  it("dolu alanları yazar", () => {
    const fields = reportJsonFields(extractReportJson(report));
    expect(fields).toHaveProperty("sectionScores");
    expect(fields).toHaveProperty("weakCriteria");
    expect(fields).toHaveProperty("reportData");
  });

  it("boş alanları hiç yazmaz — mevcut satır null'la ezilmesin", () => {
    const fields = reportJsonFields({ sectionScores: null, weakCriteria: null, reportData: null });
    expect(fields).toEqual({});
  });

  it("boş weakCriteria dizisini yazmaz", () => {
    const fields = reportJsonFields({ sectionScores: null, weakCriteria: [], reportData: { a: 1 } });
    expect(fields).toEqual({ reportData: { a: 1 } });
  });
});

describe("deriveScoreFromBlock", () => {
  const blok = {
    passedCriteria: [
      { id: "A3", earned: 1.5, weight: 1.5 },
      { id: "A2", earned: 0.5, weight: 0.5 },
    ],
    weakCriteria: [
      { id: "A1", verdict: "PARTIAL", loss: 1.5, weight: 3 },
      { id: "B2", verdict: "FAIL", loss: 3, weight: 3 },
    ],
    naCriteria: [{ id: "A5" }],
    overallScore: 65,
  };

  it("skoru kriter verisinden hesaplar, modelin yazdığına bakmaz", () => {
    // kazanılan 1.5+0.5+1.5+0 = 3.5 · uygulanabilir 1.5+0.5+3+3 = 8 → %44
    expect(deriveScoreFromBlock(blok)).toBe(44);
  });

  it("naCriteria'yı paydaya katmaz", () => {
    const ile = deriveScoreFromBlock({ ...blok, naCriteria: [{ id: "A5" }, { id: "B1" }] });
    expect(ile).toBe(44);
  });

  it("hardFail skoru sıfırlar", () => {
    expect(deriveScoreFromBlock({ ...blok, hardFail: true })).toBe(0);
  });

  it("puanlanamayan aramada null döner", () => {
    expect(deriveScoreFromBlock({ ...blok, scorable: false })).toBeNull();
  });

  it("ağırlık eksikse null döner — metinden okunan skora düşülsün", () => {
    expect(deriveScoreFromBlock({ passedCriteria: [{ id: "A1", earned: 1 }] })).toBeNull();
  });

  it("D1'i paydaya katmaz", () => {
    const ile = deriveScoreFromBlock({
      ...blok,
      weakCriteria: [...blok.weakCriteria, { id: "D1", verdict: "FAIL", loss: 0, weight: 0 }],
    });
    expect(ile).toBe(44);
  });

  it("blok yoksa null", () => {
    expect(deriveScoreFromBlock(null)).toBeNull();
    expect(deriveScoreFromBlock({})).toBeNull();
  });
});
