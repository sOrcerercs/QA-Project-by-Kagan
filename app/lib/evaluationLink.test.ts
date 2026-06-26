import { describe, it, expect } from "vitest";
import { parseEvaluationId } from "./evaluationLink";

describe("parseEvaluationId", () => {
  it("extracts the id from a full evaluation URL", () => {
    expect(parseEvaluationId("https://app.example.com/evaluation/ckabc123")).toBe("ckabc123");
  });

  it("extracts the id from a relative /evaluation/<id> path", () => {
    expect(parseEvaluationId("/evaluation/ckabc123")).toBe("ckabc123");
  });

  it("strips query string and hash", () => {
    expect(parseEvaluationId("https://x/evaluation/ckabc123?foo=1")).toBe("ckabc123");
    expect(parseEvaluationId("https://x/evaluation/ckabc123#top")).toBe("ckabc123");
  });

  it("strips a trailing slash", () => {
    expect(parseEvaluationId("https://x/evaluation/ckabc123/")).toBe("ckabc123");
  });

  it("accepts a bare id", () => {
    expect(parseEvaluationId("ckabc123")).toBe("ckabc123");
    expect(parseEvaluationId("  ckabc123  ")).toBe("ckabc123");
  });

  it("returns null for empty or whitespace input", () => {
    expect(parseEvaluationId("")).toBeNull();
    expect(parseEvaluationId("   ")).toBeNull();
    expect(parseEvaluationId("/evaluation/")).toBeNull();
  });
});
