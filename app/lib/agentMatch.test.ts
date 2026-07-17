import { describe, it, expect } from "vitest";
import { normalizeAgentName, matchAgentName } from "./agentMatch";

const users = [
  { id: "u1", name: "Faızan Ishaque" },   // DB'de noktasız ı
  { id: "u2", name: "Alexandra Boyko" },
  { id: "u3", name: "Batuhan Kızılcan" },
  { id: "u4", name: "Mehmet Akgül" },
];

describe("normalizeAgentName", () => {
  it("Türkçe I varyantlarını noktalı i'ye indirir", () => {
    expect(normalizeAgentName("Faızan Ishaque")).toBe(normalizeAgentName("Faizan Ishaque"));
    expect(normalizeAgentName("Kızılcan")).toBe("kizilcan");
    expect(normalizeAgentName("İdil")).toBe("idil");
  });
  it("x'i ks'e katlar", () => {
    expect(normalizeAgentName("Alexandra")).toBe("aleksandra");
  });
  it("diakritik strip + lowercase + trim", () => {
    expect(normalizeAgentName("  Mehmet Akgül  ")).toBe("mehmet akgul");
  });
});

describe("matchAgentName", () => {
  it("Türkçe I: gelen noktasız ad DB ile exact eşleşir", () => {
    expect(matchAgentName("faızan ıshaque", users)).toEqual({ candidate: users[0], tier: "exact" });
  });
  it("x/ks: 'Aleksandra Boyko' → 'Alexandra Boyko' exact", () => {
    expect(matchAgentName("Aleksandra Boyko", users)).toEqual({ candidate: users[1], tier: "exact" });
  });
  it("Batuhan Kizilcan (noktalı i gelen) → DB Kızılcan exact", () => {
    expect(matchAgentName("Batuhan Kizilcan", users)).toEqual({ candidate: users[2], tier: "exact" });
  });
  it("partial: ad+soyad sıra farklı → partial", () => {
    expect(matchAgentName("Akgül Mehmet", users)).toEqual({ candidate: users[3], tier: "partial" });
  });
  it("single: tek kelime DB ilk-ismiyle → single", () => {
    expect(matchAgentName("Batuhan", users)).toEqual({ candidate: users[2], tier: "single" });
  });
  it("allowPartial:false → partial elenir (null)", () => {
    expect(matchAgentName("Akgül Mehmet", users, { allowPartial: false })).toBeNull();
  });
  it("allowSingleWord:false → single elenir (null)", () => {
    expect(matchAgentName("Batuhan", users, { allowSingleWord: false })).toBeNull();
  });
  it("exact her zaman açık: opts kapalıyken bile exact döner", () => {
    expect(matchAgentName("Alexandra Boyko", users, { allowPartial: false, allowSingleWord: false }))
      .toEqual({ candidate: users[1], tier: "exact" });
  });
  it("eşleşme yok / boş / null → null", () => {
    expect(matchAgentName("Zeynep Yılmaz", users)).toBeNull();
    expect(matchAgentName("", users)).toBeNull();
    expect(matchAgentName(null, users)).toBeNull();
  });
});
