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

  // parseWeekKey'in gidiş-dönüş koruması (isoWeekKey(start) !== key → null)
  // bu modülün en ince kodu; 53 haftalık yıl sınırında bu dalda gerçek bir
  // hata bulundu. Aşağıdaki üç beklenti isoWeekKey kaynağından elle türetildi.
  it("53 haftalık yılın 53. haftasını kabul eder", () => {
    // 1 Ocak 2026 Perşembe → 2026 ISO'da 53 haftalık bir yıl.
    // firstMonday = weekStart(4 Oca 2026 Paz) = 29 Ara 2025.
    // start = 29 Ara 2025 + 52×7 = 28 Ara 2026 (Pazartesi).
    // isoWeekKey: Perşembe = 31 Ara 2026 → yıl 2026; (31 Ara 2026 − 29 Ara
    // 2025) = 367 gün; round(367/7) + 1 = 52 + 1 = 53 → "2026-W53" (eşleşir).
    const r = parseWeekKey("2026-W53");
    expect(r).not.toBeNull();
    expect(isoWeekKey(r!.start)).toBe("2026-W53");
  });

  it("52 haftalık yılda 53. haftayı reddeder", () => {
    // 1 Ocak 2025 Çarşamba, artık yıl değil → 2025 ISO'da 52 haftalık.
    // firstMonday = weekStart(4 Oca 2025 Cmt) = 30 Ara 2024.
    // start = 30 Ara 2024 + 52×7 = 29 Ara 2025; onun Perşembe'si 1 Oca 2026,
    // yani o hafta 2026'nın 1. haftası → "2026-W01" ≠ "2025-W53" → null.
    expect(parseWeekKey("2025-W53")).toBeNull();
  });

  it("yıl sınırındaki Pazartesi'yi doğru yıla bağlar", () => {
    // 30 Aralık 2024 Pazartesi; haftanın Perşembe'si 2 Ocak 2025 → ISO yılı
    // 2025. firstMonday = weekStart(4 Oca 2025) = 30 Ara 2024 → hafta 1.
    expect(isoWeekKey(new Date(2024, 11, 30))).toBe("2025-W01");
  });
});
