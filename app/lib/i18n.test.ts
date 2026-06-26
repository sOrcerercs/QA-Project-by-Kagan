import { describe, it, expect } from "vitest";
import { translations } from "./i18n";

describe("i18n ScoreView section-analysis keys", () => {
  const keys = [
    "sectionAnalysisTitle",
    "callsAverageSuffix",
    "weakestCriteria",
    "sectionAIntro",
    "sectionBSolution",
    "sectionCClosing",
  ] as const;

  it("exist and are actually localized in both tr and en", () => {
    const tr = translations.tr as Record<string, unknown>;
    const en = translations.en as Record<string, unknown>;
    for (const k of keys) {
      expect(tr[k], `tr.${k}`).toBeTruthy();
      expect(en[k], `en.${k}`).toBeTruthy();
      // en must differ from tr — otherwise it's just the Turkish string copied
      expect(en[k], `en.${k} should be translated, not the tr value`).not.toBe(tr[k]);
    }
  });
});
