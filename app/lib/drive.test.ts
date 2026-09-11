import { describe, it, expect } from "vitest";
import { parseInboxFileName } from "./drive";

describe("parseInboxFileName", () => {
  it("sözleşmeye uyan adı ayrıştırır", () => {
    const out = parseInboxFileName(
      "2026-09-10T14-59__mavican@estenove.com__1rLPJ3j-uqPC8FKUThcCh5swfNueQbntV.txt",
    );
    expect(out).not.toBeNull();
    expect(out!.agentEmail).toBe("mavican@estenove.com");
    expect(out!.meetFolderId).toBe("1rLPJ3j-uqPC8FKUThcCh5swfNueQbntV");
    // Europe/Istanbul = UTC+3, yaz saati yok → 14:59 TR = 11:59 UTC
    expect(out!.startedAt.toISOString()).toBe("2026-09-10T11:59:00.000Z");
  });

  it("e-postada nokta olan adı ayrıştırır", () => {
    const out = parseInboxFileName(
      "2026-09-11T09-05__mehmet.akgul@estenove.com__1QwJTeG1iJvW62aXOURPO0f3cFv8LWFKe.txt",
    );
    expect(out!.agentEmail).toBe("mehmet.akgul@estenove.com");
  });

  it("farklı alan adını kabul eder", () => {
    const out = parseInboxFileName(
      "2026-09-11T10-00__damla@novemedical.com__1RadtDy5V-nKZaZu6r4S7FcB0_YpvDtap.txt",
    );
    expect(out!.agentEmail).toBe("damla@novemedical.com");
  });

  it("parça sayısı yanlışsa null döner", () => {
    expect(parseInboxFileName("2026-09-10T14-59__mavican@estenove.com.txt")).toBeNull();
    expect(parseInboxFileName("a__b__c__d.txt")).toBeNull();
  });

  it("tarih biçimi bozuksa null döner", () => {
    expect(
      parseInboxFileName("2026-09-10 14:59__mavican@estenove.com__1rLPJ3jAAAAAAAAAA.txt"),
    ).toBeNull();
  });

  it("e-posta @ içermiyorsa null döner", () => {
    expect(
      parseInboxFileName("2026-09-10T14-59__mavican__1rLPJ3jAAAAAAAAAA.txt"),
    ).toBeNull();
  });

  it("klasör ID çok kısaysa null döner", () => {
    expect(
      parseInboxFileName("2026-09-10T14-59__mavican@estenove.com__abc.txt"),
    ).toBeNull();
  });

  it(".txt soneki yoksa null döner", () => {
    expect(
      parseInboxFileName("2026-09-10T14-59__mavican@estenove.com__1rLPJ3jAAAAAAAAAA"),
    ).toBeNull();
  });
});
