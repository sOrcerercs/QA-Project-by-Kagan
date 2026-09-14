import { describe, it, expect } from "vitest";
import { parseIngestPayload } from "./ingestPayload";

const gecerli = {
  meetFolderId: "1rLPJ3j-uqPC8FKUThcCh5swfNueQbntV",
  agentEmail: "mavican@estenove.com",
  startedAt: "2026-09-10T14:59:00+03:00",
  transcript: "Attendees\nA, B\nTranscript\nA: merhaba\n",
  sourceFileId: "1due12uYQqEQ_GRrakJtk2qiSTa31aXBcwLkFMJet5Y4",
};

describe("parseIngestPayload", () => {
  it("geçerli gövdeyi kabul eder", () => {
    const r = parseIngestPayload(gecerli);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.meetFolderId).toBe(gecerli.meetFolderId);
      expect(r.value.agentEmail).toBe("mavican@estenove.com");
      expect(r.value.startedAt.toISOString()).toBe("2026-09-10T11:59:00.000Z");
      expect(r.value.sourceFileId).toBe(gecerli.sourceFileId);
    }
  });

  it("sourceFileId isteğe bağlı, yoksa null", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { sourceFileId, ...eksik } = gecerli;
    const r = parseIngestPayload(eksik);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.sourceFileId).toBeNull();
  });

  it("Z ile biten UTC değeri kabul eder", () => {
    const r = parseIngestPayload({ ...gecerli, startedAt: "2026-09-10T11:59:00.000Z" });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.startedAt.toISOString()).toBe("2026-09-10T11:59:00.000Z");
  });

  it("OFSETSİZ startedAt'i REDDEDER", () => {
    // Yerel saat varsaymak sessiz bir yanlıştır: çağrı saati 3 saat kayar.
    const r = parseIngestPayload({ ...gecerli, startedAt: "2026-09-10T14:59:00" });
    expect(r).toEqual({ ok: false, error: "startedAt_no_offset" });
  });

  it("bozuk tarihi reddeder", () => {
    expect(parseIngestPayload({ ...gecerli, startedAt: "dun" }))
      .toEqual({ ok: false, error: "startedAt_format" });
  });

  it("takvim-geçersiz tarihi reddeder", () => {
    expect(parseIngestPayload({ ...gecerli, startedAt: "2026-13-40T14:59:00+03:00" }))
      .toEqual({ ok: false, error: "startedAt_format" });
  });

  it("eksik alanları ayrı ayrı bildirir", () => {
    expect(parseIngestPayload({ ...gecerli, meetFolderId: undefined }))
      .toEqual({ ok: false, error: "meetFolderId_missing" });
    expect(parseIngestPayload({ ...gecerli, agentEmail: undefined }))
      .toEqual({ ok: false, error: "agentEmail_missing" });
    expect(parseIngestPayload({ ...gecerli, startedAt: undefined }))
      .toEqual({ ok: false, error: "startedAt_missing" });
    expect(parseIngestPayload({ ...gecerli, transcript: undefined }))
      .toEqual({ ok: false, error: "transcript_missing" });
  });

  it("boş transcript'i eksik sayar", () => {
    expect(parseIngestPayload({ ...gecerli, transcript: "   " }))
      .toEqual({ ok: false, error: "transcript_missing" });
  });

  it("kısa meetFolderId'yi reddeder", () => {
    expect(parseIngestPayload({ ...gecerli, meetFolderId: "abc" }))
      .toEqual({ ok: false, error: "meetFolderId_format" });
  });

  it("@ içermeyen e-postayı reddeder", () => {
    expect(parseIngestPayload({ ...gecerli, agentEmail: "mavican" }))
      .toEqual({ ok: false, error: "agentEmail_format" });
  });

  it("gövde nesne değilse meetFolderId_missing", () => {
    expect(parseIngestPayload(null)).toEqual({ ok: false, error: "meetFolderId_missing" });
    expect(parseIngestPayload("merhaba")).toEqual({ ok: false, error: "meetFolderId_missing" });
  });

  it("fazladan alanları yok sayar", () => {
    const r = parseIngestPayload({ ...gecerli, bilinmeyen: 42 });
    expect(r.ok).toBe(true);
  });

  it("e-postayı küçük harfe indirir ve kırpar", () => {
    const r = parseIngestPayload({ ...gecerli, agentEmail: "  Mavican@Estenove.com " });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.agentEmail).toBe("mavican@estenove.com");
  });
});
