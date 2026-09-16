import { describe, it, expect } from "vitest";
import { isoWeekKey, weekStart, weekEnd, parseWeekKey } from "./isoWeek";

describe("isoWeekKey", () => {
  it("hafta numarasını iki haneli üretir", () => {
    expect(isoWeekKey(new Date(2026, 0, 8))).toBe("2026-W02");
  });

  it("aynı haftanın Pazartesi ve Pazar günü aynı anahtarı verir", () => {
    const mon = new Date(2026, 8, 14);
    const sun = new Date(2026, 8, 20);
    expect(isoWeekKey(mon)).toBe(isoWeekKey(sun));
  });
});

describe("weekStart / weekEnd", () => {
  it("haftayı Pazartesi 00:00'dan Pazar 23:59:59.999'a kurar", () => {
    const wed = new Date(2026, 8, 16, 13, 45);
    const s = weekStart(wed);
    const e = weekEnd(wed);
    expect(s.getDay()).toBe(1);
    expect(s.getHours()).toBe(0);
    expect(s.getMinutes()).toBe(0);
    expect(e.getDay()).toBe(0);
    expect(e.getHours()).toBe(23);
    expect(e.getMilliseconds()).toBe(999);
    expect(e.getTime() - s.getTime()).toBe(7 * 86400000 - 1);
  });

  it("Pazar gününü bir önceki Pazartesi'ye bağlar", () => {
    const sun = new Date(2026, 8, 20, 10, 0);
    expect(weekStart(sun).getDate()).toBe(14);
  });
});

describe("parseWeekKey", () => {
  it("geçerli anahtarı aralığa çevirir", () => {
    const r = parseWeekKey("2026-W38");
    expect(r).not.toBeNull();
    expect(isoWeekKey(r!.start)).toBe("2026-W38");
    expect(r!.start.getDay()).toBe(1);
  });

  it("biçim bozuksa null döner", () => {
    expect(parseWeekKey("2026-38")).toBeNull();
    expect(parseWeekKey("2026-W")).toBeNull();
    expect(parseWeekKey("")).toBeNull();
    expect(parseWeekKey("abcd-Wxy")).toBeNull();
  });

  it("hafta numarası aralık dışıysa null döner", () => {
    expect(parseWeekKey("2026-W00")).toBeNull();
    expect(parseWeekKey("2026-W54")).toBeNull();
  });
});
