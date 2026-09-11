import { describe, it, expect } from "vitest";
import {
  DRIVE_MAX_ATTEMPTS,
  DRIVE_STALE_LOCK_MS,
  DRIVE_ANALYZE_ESTIMATE_MS,
  pendingDriveWhere,
  canFitAnotherRow,
  isStaleDriveLock,
} from "./driveIngest";

describe("pendingDriveWhere", () => {
  it("PENDING ve deneme hakkı kalmış satırları seçer", () => {
    expect(pendingDriveWhere()).toEqual({
      status: "PENDING",
      attempts: { lt: DRIVE_MAX_ATTEMPTS },
    });
  });
});

describe("canFitAnotherRow", () => {
  it("istek başındayken bir tur sığar", () => {
    expect(canFitAnotherRow(0, 60_000, 8_000, DRIVE_ANALYZE_ESTIMATE_MS)).toBe(true);
  });
  it("tavana yaklaşınca sığmaz", () => {
    expect(canFitAnotherRow(30_000, 60_000, 8_000, DRIVE_ANALYZE_ESTIMATE_MS)).toBe(false);
  });
  it("tam sınırda sığmaz sayar", () => {
    // 60000 - 8000 - 25000 = 27000
    expect(canFitAnotherRow(27_000, 60_000, 8_000, 25_000)).toBe(false);
    expect(canFitAnotherRow(26_999, 60_000, 8_000, 25_000)).toBe(true);
  });
});

describe("isStaleDriveLock", () => {
  const now = new Date("2026-09-11T10:00:00.000Z");
  it("kilit yoksa alınabilir", () => {
    expect(isStaleDriveLock(null, now)).toBe(true);
  });
  it("taze kilit alınamaz", () => {
    expect(isStaleDriveLock(new Date(now.getTime() - 1000), now)).toBe(false);
  });
  it("eski kilit alınabilir", () => {
    expect(isStaleDriveLock(new Date(now.getTime() - DRIVE_STALE_LOCK_MS - 1), now)).toBe(true);
  });
  it("tam sınırdaki kilit alınamaz", () => {
    expect(isStaleDriveLock(new Date(now.getTime() - DRIVE_STALE_LOCK_MS), now)).toBe(false);
  });
});
