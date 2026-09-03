/**
 * Düşünmeli yeniden değerlendirmenin ortak katmanı.
 *
 * NEDEN VAR: düşünme açık analiz prod'da ~52 sn sürüyor, Vercel Hobby'de
 * istek tavanı 60 sn. Bu yüzden her istek TEK bir değerlendirme işler ve
 * döngü tarayıcıda kurulur. İki paralel istek aynı kaydı işlemesin diye
 * iyimser kilit kullanılır: kayıt damgasızken koşullu güncelleme denenir,
 * 0 satır güncellendiyse başkası kapmıştır ve sıradakine geçilir.
 *
 * Ayrı bir kuyruk tablosu YOK — kayıtlar zaten Evaluation'da.
 * "Kuyruk", deepScoredAt'i NULL olan kayıtların kendisi.
 */

import prisma from "./prisma";

/**
 * Kuyruk YALNIZCA bu tarihten itibaren çağrıları kapsar (TR günü).
 *
 * Kullanıcı kararı: kural 3 Eylül 2026'dan geçerli, öncesindeki ~4500 kayıt
 * bilinçli olarak kapsam dışı. Bu sınır VERİYE yazılmadı — eski kayıtları
 * "düşünmeli üretildi" diye damgalamak yalan olurdu ve ileride "hangileri
 * gerçekten düşünmeli?" sorusuna yanlış cevap verirdi. Sınır burada duruyor,
 * veri gerçeği söylemeye devam ediyor.
 */
export const DEEP_SCORE_FROM = new Date("2026-09-03T00:00:00.000+03:00");

/** Bu süreden eski kilit, ölmüş bir istekten kalmıştır; yeniden alınabilir. */
export const DEEP_SCORE_STALE_LOCK_MS = 5 * 60 * 1000;

/**
 * Bu kadar denemeden sonra kayıt otomatik alınmaz.
 *
 * ÖLÇÜLDÜ: prod'da tek düşünmeli çağrı ~52 sn, tavan 60 sn, kayıtların
 * ~%28'i aşıyor. Uzun transkriptli bir kayıt HER denemede aşabilir; sayaç
 * olmasa kuyruğu sonsuza kadar tıkardı. Takılanlar tavansız yoldan
 * (scripts/reclassify-range.ts) düzeltilir.
 */
export const DEEP_SCORE_MAX_ATTEMPTS = 3;

export interface RescoreTarget {
  id: string;
  customerName: string;
  callDuration: string;
  transcript: string;
  callType: string;
  score: number;
  callDate: Date;
  agentName: string | null;
  teamName: string | null;
}

/**
 * Gemini'ye gönderilen gövde. /api/evaluations/[id]/re-classify ve
 * scripts/reclassify-range.ts ile BİREBİR aynı olmalı — üç yerde ayrışırsa
 * aynı kayıt farklı yollardan farklı sonuç verir.
 */
export function buildEvaluationPrompt(promptContent: string, target: RescoreTarget): string {
  return `${promptContent}

=== DEĞERLENDİRİLECEK GÖRÜŞME BİLGİLERİ ===
Temsilci Adı: ${target.agentName ?? "Belirtilmedi"}
Takım: ${target.teamName ?? "Belirtilmedi"}
Müşteri Adı: ${target.customerName}
Görüşme Süresi: ${target.callDuration}
Değerlendirme Tarihi: ${target.callDate.toLocaleString("tr-TR", { month: "long", year: "numeric" })}

=== TRANSKRİPT ===
${target.transcript}

Yukarıdaki transkripti kurallara göre değerlendir ve ZORUNLU ÇIKTI FORMATINDA Türkçe rapor üret.`;
}

export function isStaleLock(
  lockedAt: Date | null,
  now: Date,
  staleMs = DEEP_SCORE_STALE_LOCK_MS,
): boolean {
  if (!lockedAt) return false;
  return now.getTime() - lockedAt.getTime() >= staleMs;
}

export function nextAttemptsExhausted(attempts: number, max = DEEP_SCORE_MAX_ATTEMPTS): boolean {
  return attempts >= max;
}

/**
 * Düzeltilmeyi bekleyen kayıtların filtresi.
 * Verilen aralık kesme tarihinden eskiye uzanamaz — kapsam dışı kayıtlar
 * hiçbir şekilde kuyruğa giremez.
 */
export function pendingWhere(range?: { from?: Date; to?: Date }): Record<string, unknown> {
  const from = range?.from && range.from > DEEP_SCORE_FROM ? range.from : DEEP_SCORE_FROM;
  const callDate: Record<string, unknown> = { gte: from };
  if (range?.to) callDate.lt = range.to;
  return {
    deepScoredAt: null,
    deepScoreAttempts: { lt: DEEP_SCORE_MAX_ATTEMPTS },
    callDate,
  };
}

/**
 * Sıradaki düzeltilmemiş kaydı kapar. En eski çağrıdan başlar.
 * Kimse kalmadıysa null döner.
 */
export async function claimNextEvaluation(range?: { from?: Date; to?: Date }): Promise<RescoreTarget | null> {
  const staleCutoff = new Date(Date.now() - DEEP_SCORE_STALE_LOCK_MS);
  const serbest = {
    OR: [{ deepScoreLockedAt: null }, { deepScoreLockedAt: { lt: staleCutoff } }],
  };

  // Yarış hâlinde bir sonraki adaya geç; 10 tur yeter.
  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = await prisma.evaluation.findFirst({
      where: { ...pendingWhere(range), ...serbest },
      orderBy: { callDate: "asc" },
      select: { id: true },
    });
    if (!candidate) return null;

    const claimed = await prisma.evaluation.updateMany({
      where: { id: candidate.id, deepScoredAt: null, ...serbest },
      data: { deepScoreLockedAt: new Date(), deepScoreAttempts: { increment: 1 } },
    });
    if (claimed.count !== 1) continue; // başkası kaptı

    const row = await prisma.evaluation.findUnique({
      where: { id: candidate.id },
      select: {
        id: true, customerName: true, callDuration: true, transcript: true,
        callType: true, score: true, callDate: true,
        agent: { select: { name: true, team: { select: { name: true } } } },
      },
    });
    if (!row) continue;

    return {
      id: row.id,
      customerName: row.customerName,
      callDuration: row.callDuration,
      transcript: row.transcript,
      callType: row.callType,
      score: row.score,
      callDate: row.callDate,
      agentName: row.agent?.name ?? null,
      teamName: row.agent?.team?.name ?? null,
    };
  }
  return null;
}

/** Hata: kilidi bırak — kayıt damgalanmaz, deneme hakkı varsa yeniden alınır. */
export async function releaseEvaluationLock(id: string): Promise<void> {
  await prisma.evaluation.update({
    where: { id },
    data: { deepScoreLockedAt: null },
  });
}

/** Başarı: damgala ve kilidi bırak. */
export async function markDeepScored(id: string): Promise<void> {
  await prisma.evaluation.update({
    where: { id },
    data: { deepScoredAt: new Date(), deepScoreLockedAt: null },
  });
}
