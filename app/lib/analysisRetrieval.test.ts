import { describe, it, expect } from "vitest";
import {
  extractKeywords, extractNames, buildKeywords, MAX_KEYWORDS,
  scoreCall, matchedKeywordCount, selectContext, truncateTranscript, truncateReport, buildContextBlock,
  CONTEXT_CHAR_BUDGET, MAX_CALLS, MAX_TRANSCRIPT_CHARS, MAX_REPORT_CHARS,
  type AnalysisCall,
} from "./analysisRetrieval";

function call(over: Partial<AnalysisCall> = {}): AnalysisCall {
  return {
    id: "c1",
    agentName: "Ayşe Kaya",
    customerName: "Müşteri A",
    callDate: new Date("2026-08-10T09:00:00Z"),
    callType: "SECOND_CALL",
    score: 80,
    transcript: "Danışman: merhaba. Müşteri: fiyat nedir?",
    report: "Rapor metni.",
    ...over,
  };
}

describe("extractKeywords", () => {
  it("drops stopwords and short words", () => {
    expect(extractKeywords("Bu ay çok fiyat itirazı var mı?")).toEqual(["fiyat", "itirazi"]);
  });

  it("folds Turkish characters like the agent matcher", () => {
    expect(extractKeywords("İTİRAZ şikayet")).toEqual(["itiraz", "sikayet"]);
  });

  it("deduplicates repeated words", () => {
    expect(extractKeywords("fiyat fiyat FİYAT")).toEqual(["fiyat"]);
  });

  it("strips punctuation and returns at most MAX_KEYWORDS words", () => {
    const q = "greft, kampanya; ameliyat: konsultasyon. anestezi klinik doktor ekim taksit havale";
    const out = extractKeywords(q);
    expect(out.length).toBe(MAX_KEYWORDS);
    expect(out[0]).toBe("greft");
    expect(out).not.toContain("");
  });

  it("returns an empty array for a question made only of stopwords", () => {
    expect(extractKeywords("bu ne için ve nasıl?")).toEqual([]);
  });
});

describe("extractNames", () => {
  it("pulls a consultant's full name out of a previous answer", () => {
    const prior = "Fiyat itirazına en iyi cevabı Caner Arsal veriyor (#20). Kısa özet: ...";
    expect(extractNames(prior)).toEqual(["caner", "arsal"]);
  });

  it("handles Turkish capitals and takes at most two names", () => {
    const prior = "Şeyma Yıldız ve İbrahim Öztürk iyi, Mehmet Kaya zayıf.";
    const out = extractNames(prior);
    expect(out).toEqual(["seyma", "yildiz", "ibrahim", "ozturk"]);
  });

  it("returns nothing when there is no proper name", () => {
    expect(extractNames("verilen çağrılarda bunu bulamadım")).toEqual([]);
  });
});

describe("buildKeywords", () => {
  it("carries the previous answer's name into a follow-up question", () => {
    const kws = buildKeywords(
      "Bu danışmanın zayıf yönü ne peki?",
      "Fiyat itirazına en iyi cevabı Caner Arsal veriyor (#20)."
    );
    expect(kws).toContain("caner");
    expect(kws).toContain("arsal");
    // sorunun kendi kelimeleri önce gelir
    expect(kws.indexOf("zayif")).toBeLessThan(kws.indexOf("caner"));
  });

  it("is just the question's keywords on the first turn", () => {
    expect(buildKeywords("fiyat itirazı var mı?")).toEqual(["fiyat", "itirazi"]);
  });

  it("does not duplicate a name already present in the question", () => {
    const kws = buildKeywords("Caner Arsal nasıl?", "Caner Arsal iyi iş çıkarıyor.");
    expect(kws.filter((k) => k === "caner").length).toBe(1);
  });
});

describe("scoreCall", () => {
  it("counts keyword hits in transcript and report", () => {
    const c = call({ transcript: "fiyat fiyat greft", report: "fiyat itirazı" });
    expect(scoreCall(c, ["fiyat"])).toBe(3);
    expect(scoreCall(c, ["fiyat", "greft"])).toBe(4);
  });

  it("matches across Turkish folding", () => {
    const c = call({ transcript: "İTİRAZ ettiler", report: "" });
    expect(scoreCall(c, ["itiraz"])).toBe(1);
  });

  it("returns 0 when there are no keywords", () => {
    expect(scoreCall(call(), [])).toBe(0);
  });
});

describe("matchedKeywordCount", () => {
  it("counts distinct keywords, not repetitions", () => {
    const c = call({ transcript: "fiyat fiyat fiyat", report: "" });
    expect(matchedKeywordCount(c, ["fiyat", "greft"])).toBe(1);
    expect(scoreCall(c, ["fiyat", "greft"])).toBe(3);
  });

  it("counts every distinct keyword that appears", () => {
    const c = call({ transcript: "fiyat greft", report: "anestezi" });
    expect(matchedKeywordCount(c, ["fiyat", "greft", "anestezi", "taksit"])).toBe(3);
  });

  it("returns 0 without keywords", () => {
    expect(matchedKeywordCount(call(), [])).toBe(0);
  });
});

describe("selectContext", () => {
  it("prefers broader keyword coverage over a long repetitive transcript", () => {
    const filler = "q".repeat(24_000);
    const calls = [
      // uzun ama tek kelimeyi tekrarlıyor
      call({ id: "long", transcript: `${filler} greft greft greft greft greft`, report: "" }),
      // kısa ama üç farklı kelimeyi de içeriyor
      call({ id: "broad", transcript: "greft anestezi taksit", report: "" }),
      ...Array.from({ length: MAX_CALLS + 5 }, (_, i) =>
        call({ id: `n${i}`, transcript: filler, report: "" })
      ),
    ];
    const r = selectContext(calls, ["greft", "anestezi", "taksit"]);
    expect(r.selected.map((c) => c.id)).toContain("broad");
    // uzunluk yanlılığı kırıldı: geniş kapsamalı kısa çağrı seçime giriyor
    expect(r.truncated).toBe(true);
  });

  it("sends the whole pool untouched when it fits the budget", () => {
    const calls = [
      call({ id: "a", callDate: new Date("2026-08-01T00:00:00Z") }),
      call({ id: "b", callDate: new Date("2026-08-05T00:00:00Z") }),
    ];
    const r = selectContext(calls, ["fiyat"]);
    expect(r.truncated).toBe(false);
    expect(r.poolCount).toBe(2);
    expect(r.usedCount).toBe(2);
    // en yeni önce
    expect(r.selected.map((c) => c.id)).toEqual(["b", "a"]);
  });

  it("caps the selection at MAX_CALLS and marks it truncated", () => {
    const calls = Array.from({ length: MAX_CALLS + 5 }, (_, i) =>
      call({ id: `c${i}`, transcript: "fiyat", report: "" })
    );
    const r = selectContext(calls, ["fiyat"]);
    expect(r.poolCount).toBe(MAX_CALLS + 5);
    expect(r.usedCount).toBe(MAX_CALLS);
    expect(r.truncated).toBe(true);
  });

  it("prefers the calls that match the question when it must choose", () => {
    const big = "x".repeat(20_000);
    const calls = [
      ...Array.from({ length: MAX_CALLS }, (_, i) =>
        call({ id: `noise${i}`, transcript: big, report: "" })
      ),
      call({ id: "match", transcript: `${big} greft greft greft`, report: "" }),
    ];
    const r = selectContext(calls, ["greft"]);
    expect(r.truncated).toBe(true);
    expect(r.selected.map((c) => c.id)).toContain("match");
  });

  it("stays within the character budget", () => {
    const big = "y".repeat(MAX_TRANSCRIPT_CHARS);
    const calls = Array.from({ length: 50 }, (_, i) =>
      call({ id: `c${i}`, transcript: big, report: "" })
    );
    const r = selectContext(calls, ["greft"]);
    const used = r.selected.reduce((s, c) => s + Math.min(c.transcript.length, MAX_TRANSCRIPT_CHARS), 0);
    expect(used).toBeLessThanOrEqual(CONTEXT_CHAR_BUDGET);
    expect(r.truncated).toBe(true);
  });

  it("reports an empty pool without crashing", () => {
    const r = selectContext([], ["fiyat"]);
    expect(r).toEqual({ selected: [], poolCount: 0, usedCount: 0, truncated: false });
  });
});

describe("truncateTranscript", () => {
  it("leaves short transcripts alone", () => {
    expect(truncateTranscript("kısa")).toBe("kısa");
  });

  it("cuts long transcripts and appends a note", () => {
    const out = truncateTranscript("z".repeat(MAX_TRANSCRIPT_CHARS + 5_000));
    expect(out.length).toBeLessThan(MAX_TRANSCRIPT_CHARS + 100);
    expect(out).toContain("[transcript kısaltıldı]");
  });
});

describe("truncateReport", () => {
  it("leaves short reports alone", () => {
    expect(truncateReport("kısa rapor")).toBe("kısa rapor");
  });

  it("cuts long reports and appends a note", () => {
    // Prod'da 1,5M karakterlik bir rapor var; kırpılmazsa tek başına bütçeyi yer.
    const out = truncateReport("r".repeat(1_500_000));
    expect(out.length).toBeLessThan(MAX_REPORT_CHARS + 100);
    expect(out).toContain("[rapor kısaltıldı]");
  });
});

describe("selectContext budget accounting", () => {
  it("counts a capped report cost, so a huge report does not drop the call", () => {
    const calls = [
      call({ id: "huge", transcript: "greft", report: "r".repeat(1_500_000) }),
      ...Array.from({ length: MAX_CALLS + 5 }, (_, i) =>
        call({ id: `n${i}`, transcript: "baska", report: "" })
      ),
    ];
    const r = selectContext(calls, ["greft"]);
    expect(r.truncated).toBe(true);
    expect(r.selected.map((c) => c.id)).toContain("huge");
  });
});

describe("buildContextBlock", () => {
  it("numbers the calls and labels every field", () => {
    const out = buildContextBlock([
      call({ id: "a", agentName: "Ayşe Kaya", score: 78, callType: "FIRST_CALL" }),
      call({ id: "b", agentName: "Mehmet Yıldız", score: 91 }),
    ]);
    expect(out).toContain("### Çağrı #1");
    expect(out).toContain("### Çağrı #2");
    expect(out).toContain("Danışman: Ayşe Kaya");
    expect(out).toContain("Tip: İlk Görüşme");
    expect(out).toContain("Tarih: 2026-08-10");
    expect(out).toContain("Puan: 78");
    expect(out).toContain("--- TRANSCRIPT ---");
    expect(out).toContain("--- DEĞERLENDİRME RAPORU ---");
  });

  it("omits the report section when the report is empty", () => {
    const out = buildContextBlock([call({ report: "   " })]);
    expect(out).not.toContain("DEĞERLENDİRME RAPORU");
    expect(out).toContain("--- TRANSCRIPT ---");
  });

  it("truncates an oversized report inside the block", () => {
    const out = buildContextBlock([call({ report: "r".repeat(MAX_REPORT_CHARS + 5_000) })]);
    expect(out).toContain("[rapor kısaltıldı]");
    expect(out.length).toBeLessThan(MAX_REPORT_CHARS + 5_000);
  });
});
