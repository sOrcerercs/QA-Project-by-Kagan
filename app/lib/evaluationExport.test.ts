import { describe, it, expect } from "vitest";
import { jsPDF } from "jspdf";
import {
  groupByAgent,
  slugifyFilename,
  formatReportToHtml,
  buildEvaluationHtml,
  classifyReportLine,
  renderEvaluationsToDoc,
  type ExportEvaluation,
} from "./evaluationExport";

function ev(partial: Partial<ExportEvaluation>): ExportEvaluation {
  return {
    id: "1", score: 70, customerName: "X", callDuration: "05:00",
    callDate: "2026-06-01", report: "rapor",
    ...partial,
  };
}

describe("groupByAgent", () => {
  it("groups evaluations by agent name", () => {
    const groups = groupByAgent([
      ev({ id: "a", agent: { name: "Ayşe" } }),
      ev({ id: "b", agent: { name: "Mehmet" } }),
      ev({ id: "c", agent: { name: "Ayşe" } }),
    ]);
    expect(groups).toHaveLength(2);
    const ayse = groups.find((g) => g.agentName === "Ayşe");
    expect(ayse?.evals.map((e) => e.id)).toEqual(["a", "c"]);
  });

  it("buckets missing names under 'Atanmamış'", () => {
    const groups = groupByAgent([
      ev({ id: "a", agent: { name: null } }),
      ev({ id: "b" }),
    ]);
    expect(groups).toHaveLength(1);
    expect(groups[0].agentName).toBe("Atanmamış");
    expect(groups[0].evals).toHaveLength(2);
  });
});

describe("slugifyFilename", () => {
  it("transliterates Turkish characters and replaces spaces", () => {
    expect(slugifyFilename("Ayşe Çelik")).toBe("Ayse_Celik");
    expect(slugifyFilename("İrem Öztürk")).toBe("Irem_Ozturk");
  });

  it("falls back to 'danisman' for empty input", () => {
    expect(slugifyFilename("   ")).toBe("danisman");
    expect(slugifyFilename("!!!")).toBe("danisman");
  });
});

describe("formatReportToHtml", () => {
  it("renders emoji section headers as bold headings", () => {
    const html = formatReportToHtml("📊 Genel Değerlendirme");
    expect(html).toContain("font-weight:700");
    expect(html).toContain("📊 Genel Değerlendirme");
  });

  it("renders bullet lines", () => {
    expect(formatReportToHtml("• İlk madde")).toContain("• İlk madde");
  });

  it("escapes HTML special characters", () => {
    const html = formatReportToHtml("Müşteri <script>alert(1)</script>");
    expect(html).toContain("&lt;script&gt;");
    expect(html).not.toContain("<script>");
  });

  it("renders blank lines as spacer divs", () => {
    expect(formatReportToHtml("")).toContain("height:6px");
  });
});

describe("buildEvaluationHtml", () => {
  const evals: ExportEvaluation[] = [
    { id: "a", score: 80, customerName: "Müşteri A", callDuration: "05:00", callDate: "2026-06-01", report: "📊 Bölüm\n• madde" },
    { id: "b", score: 60, customerName: "Müşteri B", callDuration: "03:00", callDate: "2026-06-02", report: "rapor b" },
  ];

  it("includes consultant name and computed average score", () => {
    const html = buildEvaluationHtml("Ayşe", evals, {}, "tr");
    expect(html).toContain("Ayşe");
    expect(html).toContain("Danışman");
    expect(html).toContain("%70"); // (80 + 60) / 2
    expect(html).toContain("Müşteri A");
    expect(html).toContain("Müşteri B");
  });

  it("adds a page break before every evaluation except the first", () => {
    const html = buildEvaluationHtml("Ayşe", evals, {}, "tr");
    const breaks = html.match(/page-break-before:always/g) ?? [];
    expect(breaks).toHaveLength(1); // sadece ikinci değerlendirme
  });

  it("shows 'Tümü' range label when no dates given (tr)", () => {
    expect(buildEvaluationHtml("Ayşe", evals, {}, "tr")).toContain("Tümü");
  });

  it("handles empty evaluation list with zero average", () => {
    const html = buildEvaluationHtml("Ayşe", [], {}, "tr");
    expect(html).toContain("%0");
    expect(html).not.toContain("page-break-before:always");
  });

  it("uses English labels when lang is en", () => {
    const html = buildEvaluationHtml("Ayşe", evals, {}, "en");
    expect(html).toContain("Consultant");
    expect(html).toContain("Evaluation Report");
  });
});

describe("classifyReportLine", () => {
  it("classifies each line kind", () => {
    expect(classifyReportLine("📊 Bölüm")).toBe("section");
    expect(classifyReportLine("Müşteri: X")).toBe("meta");
    expect(classifyReportLine("• madde")).toBe("bullet");
    expect(classifyReportLine("Kanıt: foo")).toBe("evidence");
    expect(classifyReportLine("Olması Gereken: bar")).toBe("expected");
    expect(classifyReportLine("")).toBe("blank");
    expect(classifyReportLine("düz metin")).toBe("default");
  });
});

describe("renderEvaluationsToDoc", () => {
  const mk = (n: number): ExportEvaluation[] =>
    Array.from({ length: n }, (_, i) => ({
      id: String(i), score: 70, customerName: "Müşteri " + i,
      callDuration: "05:00", callDate: "2026-06-01", report: "📊 Bölüm\n• madde\nKanıt: x",
    }));

  it("starts a new page for each evaluation", () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    renderEvaluationsToDoc(doc, "Ayşe", mk(3), {}, "tr");
    expect(doc.getNumberOfPages()).toBeGreaterThanOrEqual(3);
  });

  it("renders an empty list as a single page without throwing", () => {
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    expect(() => renderEvaluationsToDoc(doc, "Ayşe", [], {}, "tr")).not.toThrow();
    expect(doc.getNumberOfPages()).toBe(1);
  });

  // Regression guard for the html2canvas hang: a huge report must paginate
  // natively instead of overflowing a single canvas.
  it("paginates a very large report without hanging or throwing", () => {
    const huge: ExportEvaluation[] = [{
      id: "x", score: 80, customerName: "Big", callDuration: "01:00",
      callDate: "2026-06-01", report: "satır metni\n".repeat(20000),
    }];
    const doc = new jsPDF({ unit: "mm", format: "a4" });
    expect(() => renderEvaluationsToDoc(doc, "Ayşe", huge, {}, "tr")).not.toThrow();
    expect(doc.getNumberOfPages()).toBeGreaterThan(10);
  });
});
