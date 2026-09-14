import { describe, it, expect, afterEach } from "vitest";
import { isIngestConfigured, checkIngestAuth } from "./ingestAuth";

const ESKI = process.env.MEET_INGEST_SECRET;
afterEach(() => {
  if (ESKI === undefined) delete process.env.MEET_INGEST_SECRET;
  else process.env.MEET_INGEST_SECRET = ESKI;
});

describe("isIngestConfigured", () => {
  it("sır varsa true", () => {
    process.env.MEET_INGEST_SECRET = "abc";
    expect(isIngestConfigured()).toBe(true);
  });
  it("sır yoksa false", () => {
    delete process.env.MEET_INGEST_SECRET;
    expect(isIngestConfigured()).toBe(false);
  });
  it("boş dize yapılandırılmamış sayılır", () => {
    process.env.MEET_INGEST_SECRET = "";
    expect(isIngestConfigured()).toBe(false);
  });
});

describe("checkIngestAuth", () => {
  it("doğru Bearer kabul edilir", () => {
    process.env.MEET_INGEST_SECRET = "s3cret";
    expect(checkIngestAuth("Bearer s3cret")).toBe("ok");
  });
  it("yanlış sır reddedilir", () => {
    process.env.MEET_INGEST_SECRET = "s3cret";
    expect(checkIngestAuth("Bearer yanlis")).toBe("unauthorized");
  });
  it("başlık yoksa reddedilir", () => {
    process.env.MEET_INGEST_SECRET = "s3cret";
    expect(checkIngestAuth(null)).toBe("unauthorized");
  });
  it("Bearer öneki yoksa reddedilir", () => {
    process.env.MEET_INGEST_SECRET = "s3cret";
    expect(checkIngestAuth("s3cret")).toBe("unauthorized");
  });
  it("sır tanımsızsa unconfigured — açık uç bırakmaz", () => {
    delete process.env.MEET_INGEST_SECRET;
    expect(checkIngestAuth("Bearer herhangi")).toBe("unconfigured");
  });
});
