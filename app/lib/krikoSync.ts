/**
 * Kriko senkronizasyonunun PAYLAŞILAN mantığı.
 *
 * NEDEN AYRI DOSYA: aynı işi üç yerden yapmak gerekiyor — manuel sync,
 * gece cron'u ve parçalı kuyruk (sync/next). Kod eskiden sync ve cron
 * route'larında AYRI AYRI duruyordu; üçüncü bir kopya çıkarmamak için
 * buraya taşındı.
 *
 * ÖLÇÜLDÜ (prod): tek bir çağrının alınması ~20.7 sn sürüyor ve bunun
 * neredeyse tamamı Gemini analizi. Vercel Hobby tavanı 60 sn olduğu için
 * tek istekte en fazla 2-3 çağrı işlenebilir — parçalı kuyruğun sebebi bu.
 */

import prisma from "@/app/lib/prisma";
import { matchAgentName } from "@/app/lib/agentMatch";
import { formatDuration, KrikoCall } from "@/app/lib/kriko";
import { shouldForceFirstCall } from "@/app/lib/evaluationRules";
import { isDuplicateCallError } from "@/app/lib/prismaErrors";

export const UNASSIGNED_EMAIL = "unassigned@estenove.local";
export const UNASSIGNED_NAME = "Atanmamış";

/** "Unassigned" özel kullanıcısını bul/oluştur (kim olduğu belirsiz çağrılar için) */
export async function getOrCreateUnassignedUser() {
  let user = await prisma.user.findUnique({ where: { email: UNASSIGNED_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: UNASSIGNED_NAME,
        email: UNASSIGNED_EMAIL,
        passwordHash: "DISABLED",   // bu kullanıcı login olamaz
        role: "AGENT",
      },
    });
  }
  return user;
}

/** Kriko agent_name → DB'deki User. Diakritik/case + Türkçe I / x-ks duyarsız. */
export async function matchAgent(agentName: string | null) {
  if (!agentName) return null;
  const candidates = await prisma.user.findMany({
    where: { role: { in: ["AGENT", "TEAM_LEADER", "MANAGER"] } },
    select: { id: true, name: true },
  });
  return matchAgentName(agentName, candidates)?.candidate ?? null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Analyze çağrısı — 429 alırsa exponential backoff ile 3 kez dener */
export async function analyzeWithRetry(formData: FormData, baseUrl: string, maxRetries = 3): Promise<{ ok: boolean; data?: any; error?: string }> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const r = await fetch(`${baseUrl}/api/analyze`, { method: "POST", body: formData });
      if (r.ok) return { ok: true, data: await r.json() };
      const errText = await r.text().catch(() => "");
      const isRateLimit = r.status === 429 ||
        (r.status === 500 && (
          errText.includes("Rate limit") ||
          errText.includes("exceeded your current quota") ||
          errText.includes("Quota exceeded") ||
          errText.includes("retry")
        ));
      if (isRateLimit && attempt < maxRetries - 1) {
        const retryMatch = errText.match(/(?:try again|retry) in (\d+(?:\.\d+)?)s/i);
        const wait = retryMatch ? (Math.ceil(parseFloat(retryMatch[1])) + 5) * 1000 : 65000;
        await sleep(wait);
        continue;
      }
      return { ok: false, error: `${r.status} ${errText.slice(0, 150)}` };
    } catch (e: any) {
      if (attempt < maxRetries - 1) { await sleep(3000); continue; }
      return { ok: false, error: e.message };
    }
  }
  return { ok: false, error: "max_retries_exceeded" };
}

/** Tek çağrıyı analyze et + Evaluation kaydet. */
export async function processCall(call: KrikoCall, unassignedUserId: string, baseUrl: string) {
  // Mükerrer kontrolü
  const existing = await prisma.evaluation.findUnique({ where: { externalCallId: call.id } });
  if (existing) {
    // Kriko, deal_id'yi (ve ses kaydını) gecikmeyle ekler — ilk sync deal_id'siz
    // yakalanırsa recordingUrl NULL kalır. Sonraki sync'lerde deal_id geldiyse
    // ses URL'ini geriye doldur. İdempotent: aynı URL'de no-op.
    const dealUrl = call.deal_id
      ? `${process.env.KRIKO_API_BASE}/api/deals/${call.deal_id}/audio`
      : null;
    if (dealUrl && existing.recordingUrl !== dealUrl) {
      await prisma.evaluation.update({ where: { id: existing.id }, data: { recordingUrl: dealUrl } });
    }
    return { status: "skipped" as const, reason: "already_imported" };
  }

  // Agent eşleşmesi
  const matched = await matchAgent(call.agent_name);
  const agentId = matched?.id ?? unassignedUserId;
  const isUnassigned = !matched;

  // Transcript içeriği
  const transcript = call.transcript?.content ?? "";
  if (transcript.length < 50) return { status: "skipped" as const, reason: "no_transcript" };

  // Analiz et — internal /api/analyze çağrısı
  const forceFirstCall = await shouldForceFirstCall(matched?.id);

  const formData = new FormData();
  formData.append("transcript", transcript);
  formData.append("agentName", call.agent_name || "Belirtilmedi");
  formData.append("customerName", call.customer_name || "Belirtilmedi");
  formData.append("callDuration", formatDuration(call.duration_seconds));
  formData.append("callType", forceFirstCall ? "FIRST_CALL" : "AUTO");

  const result = await analyzeWithRetry(formData, baseUrl);
  if (!result.ok) {
    return { status: "failed" as const, reason: `analyze_error: ${result.error}` };
  }
  const report = result.data.report || "";
  const score = result.data.score || 0;
  const callType = result.data.callType || "SECOND_CALL";
  const promptId = result.data.promptId || null;
  const weakCriteria = result.data.weakCriteria ?? null;
  const sectionScores = result.data.sectionScores ?? null;
  const reportData = result.data.reportData ?? null;

  // Evaluation kaydet
  let evaluation;
  try {
    evaluation = await prisma.evaluation.create({
    data: {
      agentId,
      customerName: call.customer_name || "Bilinmiyor",
      callDuration: formatDuration(call.duration_seconds),
      transcript,
      report,
      score,
      callType: callType as any,
      promptId,
      callDate: new Date(call.call_date),
      externalCallId: call.id,
      externalAgentName: call.agent_name,
      recordingUrl: call.deal_id
        ? `${process.env.KRIKO_API_BASE}/api/deals/${call.deal_id}/audio`
        : (call.recording_url || null),
      unassigned: isUnassigned,
      source: "KRIKO",
      weakCriteria,
      sectionScores,
      reportData,
      },
    });
  } catch (e) {
    // Paralel bir koşu bu çağrıyı araya girip yazdı — hata değil, atla.
    if (isDuplicateCallError(e)) return { status: "skipped" as const, reason: "already_imported" };
    throw e;
  }

  if (!isUnassigned) {
    const agent = await prisma.user.findUnique({ where: { id: agentId }, select: { teamId: true } });
    const notifyIds: string[] = [agentId];
    if (agent?.teamId) {
      const team = await prisma.team.findUnique({ where: { id: agent.teamId }, select: { leaderId: true } });
      if (team?.leaderId) notifyIds.push(team.leaderId);
    }
    await prisma.notification.createMany({
      data: notifyIds.map(uid => ({
        userId: uid,
        type: "EVALUATION",
        message: `${call.customer_name || "Bilinmiyor"} için değerlendirme tamamlandı. Skor: %${score}`,
        referenceId: evaluation.id,
      })),
      skipDuplicates: true,
    });
  }

  return { status: isUnassigned ? "unassigned" as const : "imported" as const, agentName: call.agent_name };
}
