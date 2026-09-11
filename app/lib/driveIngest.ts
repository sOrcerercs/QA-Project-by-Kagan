/**
 * Google Meet alma hattının kuyruk çekirdeği.
 *
 * İki faz var çünkü Vercel Hobby istek tavanı 60 sn:
 *   Faz 1 — Apps Script POST eder, DriveTranscript satırı yazılır (Gemini YOK)
 *   Faz 2 — istek başına BİR satır Evaluation'a çevrilir
 *
 * Kalıp app/lib/deepScore.ts'ten alındı: iyimser kilit, deneme sayacı,
 * tavanın altında kendi bütçesi. Yeni bir mekanizma icat edilmiyor.
 */

import prisma from "./prisma";
import { DEEP_SCORE_REQUEST_CAP_MS, DEEP_SCORE_RESERVE_MS } from "./rescoreStep";

/** Bu kadar denemeden sonra satır otomatik alınmaz (deepScore ile aynı sayı). */
export const DRIVE_MAX_ATTEMPTS = 3;

/** Bu süreden eski kilit ölmüş bir istekten kalmıştır; yeniden alınabilir. */
export const DRIVE_STALE_LOCK_MS = 5 * 60 * 1000;

/**
 * Bir satırı almanın tahmini süresi. Düşünme KAPALI analiz ~15 sn ölçüldü;
 * uzun transkript ve Supabase gecikmesi için 25 sn pay bırakılıyor.
 * İlk gerçek koşulardan sonra ölçüme göre düzeltilecek.
 */
export const DRIVE_ANALYZE_ESTIMATE_MS = 25_000;

export function pendingDriveWhere(): Record<string, unknown> {
  return { status: "PENDING", attempts: { lt: DRIVE_MAX_ATTEMPTS } };
}

/**
 * Tavana çarpmadan bir tur daha sığar mı?
 *
 * Platform süreci öldürdüğünde `catch` HİÇ çalışmaz ve kilit bırakılmaz;
 * bu yüzden tavana yaklaşınca kendimiz duruyoruz.
 */
export function canFitAnotherRow(
  elapsedMs: number,
  capMs: number = DEEP_SCORE_REQUEST_CAP_MS,
  reserveMs: number = DEEP_SCORE_RESERVE_MS,
  estimateMs: number = DRIVE_ANALYZE_ESTIMATE_MS,
): boolean {
  return elapsedMs < capMs - reserveMs - estimateMs;
}

export function isStaleDriveLock(lockedAt: Date | null, now: Date = new Date()): boolean {
  if (!lockedAt) return true;
  return lockedAt.getTime() < now.getTime() - DRIVE_STALE_LOCK_MS;
}

export interface DriveClaim {
  id: string;
  meetFolderId: string;
  agentEmail: string;
  startedAt: Date;
  transcript: string;
}

/**
 * Sıradaki satırı iyimser kilitle kapar (deepScore'un claimNextEvaluation
 * kalıbı). Yarış hâlinde bir sonraki adaya geçer; 10 tur yeter.
 */
export async function claimNextDriveTranscript(): Promise<DriveClaim | null> {
  const staleCutoff = new Date(Date.now() - DRIVE_STALE_LOCK_MS);
  const serbest = { OR: [{ lockedAt: null }, { lockedAt: { lt: staleCutoff } }] };

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = await prisma.driveTranscript.findFirst({
      where: { ...pendingDriveWhere(), ...serbest },
      orderBy: { startedAt: "asc" },
      select: { id: true },
    });
    if (!candidate) return null;

    const claimed = await prisma.driveTranscript.updateMany({
      where: { id: candidate.id, status: "PENDING", ...serbest },
      data: { lockedAt: new Date(), attempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue; // başkası kaptı

    const row = await prisma.driveTranscript.findUnique({
      where: { id: candidate.id },
      select: {
        id: true, meetFolderId: true, agentEmail: true,
        startedAt: true, transcript: true,
      },
    });
    if (!row) {
      // Kaptık ama okuyamadık. Kilidi bırakmazsak 5 dk kilitli kalır ve
      // bir deneme hakkı boşuna yanar.
      await releaseDriveLock(candidate.id).catch(() => {});
      continue;
    }
    return row;
  }
  return null;
}

export async function releaseDriveLock(id: string): Promise<void> {
  await prisma.driveTranscript.update({ where: { id }, data: { lockedAt: null } });
}

export async function markDriveSkipped(id: string, reason: string): Promise<void> {
  await prisma.driveTranscript.update({
    where: { id },
    data: { status: "SKIPPED", skipReason: reason, lockedAt: null },
  });
}

export async function markDriveImported(id: string, evaluationId: string): Promise<void> {
  await prisma.driveTranscript.update({
    where: { id },
    data: { status: "IMPORTED", evaluationId, importedAt: new Date(), lockedAt: null, error: null },
  });
}

/**
 * Başarısız ama tekrar denenebilir. Durum PENDING kalır; hakkı tükendiğinde
 * pendingDriveWhere() satırı kendiliğinden kuyruktan düşürür.
 */
export async function markDriveRetryable(id: string, error: string): Promise<void> {
  await prisma.driveTranscript.update({
    where: { id },
    data: { error: error.slice(0, 500), lockedAt: null },
  });
}
