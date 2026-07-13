import { describe, it, expect } from "vitest";
import { evaluationBadgeVisibility } from "./evaluationBadges";

describe("evaluationBadgeVisibility", () => {
  it("AGENT sadece okuma rozetini görür, coaching görmez", () => {
    expect(evaluationBadgeVisibility("AGENT")).toEqual({ showRead: true, showCoaching: false });
  });

  it("TEAM_LEADER hem okuma hem coaching rozetini görür", () => {
    expect(evaluationBadgeVisibility("TEAM_LEADER")).toEqual({ showRead: true, showCoaching: true });
  });

  it("MANAGER hem okuma hem coaching rozetini görür", () => {
    expect(evaluationBadgeVisibility("MANAGER")).toEqual({ showRead: true, showCoaching: true });
  });

  it("ADMIN hem okuma hem coaching rozetini görür", () => {
    expect(evaluationBadgeVisibility("ADMIN")).toEqual({ showRead: true, showCoaching: true });
  });

  it("rol yoksa (undefined/null) hiç rozet gösterilmez — sadece rol geçilen listeler rozet alır", () => {
    // EvaluationList birden çok yerde kullanılıyor; userRole geçmeyen çağrılarda
    // (Takım sekmesi, Takım Raporu, Skorlarım) rozet hiç çıkmamalı.
    expect(evaluationBadgeVisibility(undefined)).toEqual({ showRead: false, showCoaching: false });
    expect(evaluationBadgeVisibility(null)).toEqual({ showRead: false, showCoaching: false });
  });
});
