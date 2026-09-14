import { describe, it, expect } from "vitest";
import {
  DRIVE_MAX_ATTEMPTS,
  DRIVE_STALE_LOCK_MS,
  DRIVE_ANALYZE_ESTIMATE_MS,
  pendingDriveWhere,
  canFitAnotherRow,
  isStaleDriveLock,
  driveRowState,
  checkDriveEmailAssignment,
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

describe("driveRowState", () => {
  // Panelin dört kovası: beklemede / sıkışmış / elenmiş / alınmış.
  // "PENDING ama hakkı tükenmiş" kovası ayrı olmazsa satır görünmez olur —
  // bu, dal geneli incelemede Critical olarak bulunan hatanın ta kendisi.
  it("taze PENDING beklemededir", () => {
    expect(driveRowState({ status: "PENDING", attempts: 0 })).toBe("pending");
  });
  it("hakkı kalan PENDING hâlâ beklemededir", () => {
    expect(driveRowState({ status: "PENDING", attempts: DRIVE_MAX_ATTEMPTS - 1 })).toBe("pending");
  });
  it("hakkı tükenen PENDING sıkışmıştır", () => {
    expect(driveRowState({ status: "PENDING", attempts: DRIVE_MAX_ATTEMPTS })).toBe("exhausted");
  });
  it("sınırın üstü de sıkışmıştır", () => {
    expect(driveRowState({ status: "PENDING", attempts: DRIVE_MAX_ATTEMPTS + 5 })).toBe("exhausted");
  });
  it("ELENEN satır, denemesi dolu olsa bile elenmiştir", () => {
    // Eleme kararı nihaidir; deneme sayacına bakıp "sıkışmış" demek yanlış olur.
    expect(driveRowState({ status: "SKIPPED", attempts: DRIVE_MAX_ATTEMPTS })).toBe("skipped");
  });
  it("alınan satır alınmıştır", () => {
    expect(driveRowState({ status: "IMPORTED", attempts: 1 })).toBe("imported");
  });
});

describe("checkDriveEmailAssignment", () => {
  const rowAgentEmail = "damla@novemedical.com";

  it("e-posta zaten seçilen kişiye bağlıysa iş yok", () => {
    expect(checkDriveEmailAssignment({
      rowAgentEmail, chosenUserId: "u1",
      chosenUserDriveEmail: rowAgentEmail, emailOwnerUserId: "u1",
    })).toEqual({ ok: true, bindEmail: false });
  });

  it("e-posta boştaysa bağlanır", () => {
    expect(checkDriveEmailAssignment({
      rowAgentEmail, chosenUserId: "u1",
      chosenUserDriveEmail: null, emailOwnerUserId: null,
    })).toEqual({ ok: true, bindEmail: true });
  });

  it("e-posta BAŞKASINA bağlıysa reddedilir", () => {
    // Sessizce çalmak, o kişinin bütün Meet çağrılarını yeni kişiye kaydırır.
    expect(checkDriveEmailAssignment({
      rowAgentEmail, chosenUserId: "u1",
      chosenUserDriveEmail: null, emailOwnerUserId: "u2",
    })).toEqual({ ok: false, reason: "email_taken_by_other" });
  });

  it("seçilen kişinin BAŞKA bir Drive e-postası varsa reddedilir", () => {
    // Üzerine yazmak, o kişinin eski hesabından gelen çağrıları kör eder.
    expect(checkDriveEmailAssignment({
      rowAgentEmail, chosenUserId: "u1",
      chosenUserDriveEmail: "eski@estenove.com", emailOwnerUserId: null,
    })).toEqual({ ok: false, reason: "user_bound_to_other_email" });
  });

  it("başkasına bağlılık, kişinin kendi e-postasından ÖNCE bakılır", () => {
    // İki sorun birdense daha tehlikeli olanı raporla.
    expect(checkDriveEmailAssignment({
      rowAgentEmail, chosenUserId: "u1",
      chosenUserDriveEmail: "eski@estenove.com", emailOwnerUserId: "u2",
    })).toEqual({ ok: false, reason: "email_taken_by_other" });
  });
});
