import { describe, it, expect } from "vitest";
import { POSITIVE_COACHING, composePositiveFeedback } from "./positiveCoaching";

const allKeys = POSITIVE_COACHING.flatMap((c) => c.items.map((i) => `${c.key}.${i.key}`));

describe("POSITIVE_COACHING taksonomi", () => {
  it("6 kategori içerir", () => {
    expect(POSITIVE_COACHING.map((c) => c.key)).toEqual([
      "resolution", "advisor", "product", "process", "referral", "tools",
    ]);
  });
  it("her item'da tr/en label ve tr/en text dolu", () => {
    for (const c of POSITIVE_COACHING) for (const i of c.items) {
      expect(i.label.tr && i.label.en).toBeTruthy();
      expect(i.text.tr && i.text.en).toBeTruthy();
    }
  });
  it("global key'ler benzersiz", () => {
    expect(new Set(allKeys).size).toBe(allKeys.length);
  });
});

describe("composePositiveFeedback", () => {
  it("boş seçim → boş string", () => {
    expect(composePositiveFeedback([], "tr")).toBe("");
  });
  it("seçilen item'ı '<label>: <text>' olarak yazar (tr)", () => {
    const out = composePositiveFeedback(["advisor.knowledge"], "tr");
    expect(out).toContain("Bilgi");
    expect(out).toContain("Teknikler, greft sayısı");
  });
  it("dil en ise İngilizce metni yazar", () => {
    const out = composePositiveFeedback(["advisor.knowledge"], "en");
    expect(out).toContain("Knowledge");
    expect(out).toContain("full command of the techniques");
  });
  it("çok seçimde taksonomi sırasını korur ve \\n\\n ile ayırır", () => {
    const out = composePositiveFeedback(["advisor.listening", "resolution.other"], "tr");
    const iRes = out.indexOf("Diğer");
    const iLis = out.indexOf("Dinleme");
    expect(iRes).toBeGreaterThanOrEqual(0);
    expect(iLis).toBeGreaterThan(iRes);
    expect(out).toContain("\n\n");
  });
  it("geçersiz key yok sayılır", () => {
    expect(composePositiveFeedback(["nope.nope"], "tr")).toBe("");
  });
});
