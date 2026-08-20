import { describe, it, expect } from "vitest";
import {
  extractKeywords, MAX_KEYWORDS,
  scoreCall, selectContext, truncateTranscript, buildContextBlock,
  CONTEXT_CHAR_BUDGET, MAX_CALLS, MAX_TRANSCRIPT_CHARS,
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

describe("selectContext", () => {
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
});
