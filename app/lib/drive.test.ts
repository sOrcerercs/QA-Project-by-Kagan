import { describe, it, expect } from "vitest";
import { parseInboxFileName, isDriveConfigured, normalizePrivateKey, isTokenFresh } from "./drive";

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

describe("normalizePrivateKey", () => {
  it("kaçışlı \\n'leri gerçek satır sonuna çevirir", () => {
    const out = normalizePrivateKey("-----BEGIN PRIVATE KEY-----\\nAAA\\n-----END PRIVATE KEY-----\\n");
    expect(out).toBe("-----BEGIN PRIVATE KEY-----\nAAA\n-----END PRIVATE KEY-----\n");
  });

  it("zaten gerçek satır sonu varsa bozmaz", () => {
    const real = "-----BEGIN PRIVATE KEY-----\nAAA\n-----END PRIVATE KEY-----\n";
    expect(normalizePrivateKey(real)).toBe(real);
  });

  it("çevreleyen çift tırnakları atar", () => {
    expect(normalizePrivateKey('"abc"')).toBe("abc");
  });

  it("başındaki yatay boşluk kaldırır ama satır sonu tutmaz", () => {
    // Yapıştırma artefaktından baştaki boşluk kaldırılmalı,
    // PEM'nin başında -----BEGIN eksikse importPKCS8 başarısız olur.
    const withLeadingSpace = "  -----BEGIN PRIVATE KEY-----\nAAA\n-----END PRIVATE KEY-----\n";
    const expected = "-----BEGIN PRIVATE KEY-----\nAAA\n-----END PRIVATE KEY-----\n";
    expect(normalizePrivateKey(withLeadingSpace)).toBe(expected);
  });

  it("tırnak öncesinde yatay boşluk kaldırır", () => {
    const withSpaceBeforeQuote = '  "abc"';
    expect(normalizePrivateKey(withSpaceBeforeQuote)).toBe("abc");
  });
});

describe("isDriveConfigured", () => {
  it("üç env değişkeni de varsa true", () => {
    process.env.GOOGLE_DRIVE_SA_EMAIL = "a@b.iam.gserviceaccount.com";
    process.env.GOOGLE_DRIVE_SA_PRIVATE_KEY = "k";
    process.env.GOOGLE_DRIVE_INBOX_FOLDER_ID = "f";
    expect(isDriveConfigured()).toBe(true);
  });

  it("biri eksikse false", () => {
    process.env.GOOGLE_DRIVE_SA_EMAIL = "a@b.iam.gserviceaccount.com";
    process.env.GOOGLE_DRIVE_SA_PRIVATE_KEY = "k";
    delete process.env.GOOGLE_DRIVE_INBOX_FOLDER_ID;
    expect(isDriveConfigured()).toBe(false);
  });
});

describe("isTokenFresh", () => {
  it("null expires_at ise false", () => {
    expect(isTokenFresh(null, 1000)).toBe(false);
  });

  it("şu andan sonra süresi bitiyorsa true", () => {
    const now = 1000;
    const futureExpiry = now + 10 * 60 * 1000; // 10 dakika sonra
    expect(isTokenFresh(futureExpiry, now)).toBe(true);
  });

  it("şu andan 5 dakika içinde süresi bitiyorsa false (margin)", () => {
    const now = 1000;
    const soonExpiry = now + 3 * 60 * 1000; // 3 dakika sonra (margin'ın altında)
    expect(isTokenFresh(soonExpiry, now)).toBe(false);
  });

  it("margin sınırında (exactly 5 min later) false", () => {
    const now = 1000;
    const atMargin = now + 5 * 60 * 1000; // Tam 5 dakika sonra
    expect(isTokenFresh(atMargin, now)).toBe(false);
  });

  it("margin sınırından bir ms sonra true", () => {
    const now = 1000;
    const afterMargin = now + 5 * 60 * 1000 + 1; // Tam 5 dakika + 1ms
    expect(isTokenFresh(afterMargin, now)).toBe(true);
  });
});
