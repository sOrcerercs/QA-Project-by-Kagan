import { describe, it, expect } from "vitest";
import { findDuplicateGroups, UNKNOWN_CUSTOMER } from "./duplicateEvaluations";

const row = (id: string, agentId: string, customerName: string, iso: string) => ({
  id, agentId, customerName, callDate: new Date(iso),
});

describe("findDuplicateGroups", () => {
  it("aynı danışman + müşteri + birebir aynı saat KESIN sayılır", () => {
    const out = findDuplicateGroups([
      row("a", "u1", "Ali Veli", "2026-08-07T15:00:00Z"),
      row("b", "u1", "Ali Veli", "2026-08-07T15:00:00Z"),
    ], 15);
    expect(out).toHaveLength(1);
    expect(out[0].tier).toBe("KESIN");
    expect(out[0].minutesApart).toBe(0);
    expect(out[0].rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("pencere içinde saat kayması COK_OLASI sayılır ve fark dakikayla döner", () => {
    const out = findDuplicateGroups([
      row("a", "u1", "Ali Veli", "2026-08-07T15:00:00Z"),
      row("b", "u1", "Ali Veli", "2026-08-07T15:05:00Z"),
    ], 15);
    expect(out[0].tier).toBe("COK_OLASI");
    expect(out[0].minutesApart).toBe(5);
  });

  it("pencere dışındaki çağrı gruplanmaz", () => {
    const out = findDuplicateGroups([
      row("a", "u1", "Ali Veli", "2026-08-07T15:00:00Z"),
      row("b", "u1", "Ali Veli", "2026-08-07T15:20:00Z"),
    ], 15);
    expect(out).toEqual([]);
  });

  it("farklı müşteriyle arka arkaya yapılan çağrılar gruplanmaz", () => {
    const out = findDuplicateGroups([
      row("a", "u1", "Ali Veli", "2026-08-07T15:00:00Z"),
      row("b", "u1", "Ayşe Fatma", "2026-08-07T15:05:00Z"),
    ], 15);
    expect(out).toEqual([]);
  });

  it("farklı danışmanın aynı müşteriyle çağrısı gruplanmaz", () => {
    const out = findDuplicateGroups([
      row("a", "u1", "Ali Veli", "2026-08-07T15:00:00Z"),
      row("b", "u2", "Ali Veli", "2026-08-07T15:00:00Z"),
    ], 15);
    expect(out).toEqual([]);
  });

  it("zincirleme kayma tek grupta toplanır", () => {
    const out = findDuplicateGroups([
      row("a", "u1", "Ali Veli", "2026-08-07T15:00:00Z"),
      row("b", "u1", "Ali Veli", "2026-08-07T15:10:00Z"),
      row("c", "u1", "Ali Veli", "2026-08-07T15:20:00Z"),
    ], 15);
    expect(out).toHaveLength(1);
    expect(out[0].rows.map((r) => r.id)).toEqual(["a", "b", "c"]);
    expect(out[0].minutesApart).toBe(20); // gruptaki en büyük fark
    expect(out[0].tier).toBe("COK_OLASI");
  });

  it("müşteri adında büyük/küçük harf ve boşluk farkı aynı sayılır", () => {
    const out = findDuplicateGroups([
      row("a", "u1", " Ali Veli ", "2026-08-07T15:00:00Z"),
      row("b", "u1", "ALİ VELİ", "2026-08-07T15:00:00Z"),
    ], 15);
    expect(out).toHaveLength(1);
  });

  it("müşteri adı bilinmeyen grup işaretlenir", () => {
    const out = findDuplicateGroups([
      row("a", "u1", UNKNOWN_CUSTOMER, "2026-08-07T15:00:00Z"),
      row("b", "u1", UNKNOWN_CUSTOMER, "2026-08-07T15:00:00Z"),
    ], 15);
    expect(out[0].customerUnknown).toBe(true);
  });

  it("adı bilinen grup işaretlenmez", () => {
    const out = findDuplicateGroups([
      row("a", "u1", "Ali Veli", "2026-08-07T15:00:00Z"),
      row("b", "u1", "Ali Veli", "2026-08-07T15:00:00Z"),
    ], 15);
    expect(out[0].customerUnknown).toBe(false);
  });

  it("eşi olmayan çağrı grupları arasında yer almaz", () => {
    const out = findDuplicateGroups([
      row("a", "u1", "Ali Veli", "2026-08-07T15:00:00Z"),
      row("b", "u1", "Ali Veli", "2026-08-07T15:00:00Z"),
      row("tek", "u1", "Ali Veli", "2026-08-07T19:00:00Z"),
    ], 15);
    expect(out).toHaveLength(1);
    expect(out[0].rows.map((r) => r.id)).toEqual(["a", "b"]);
  });

  it("gruplar en yeni çağrı önce sıralanır", () => {
    const out = findDuplicateGroups([
      row("eski1", "u1", "Ali", "2026-06-01T10:00:00Z"),
      row("eski2", "u1", "Ali", "2026-06-01T10:00:00Z"),
      row("yeni1", "u1", "Veli", "2026-08-01T10:00:00Z"),
      row("yeni2", "u1", "Veli", "2026-08-01T10:00:00Z"),
    ], 15);
    expect(out.map((g) => g.rows[0].id)).toEqual(["yeni1", "eski1"]);
  });

  it("boş girdide boş dizi döner", () => {
    expect(findDuplicateGroups([], 15)).toEqual([]);
  });
});
