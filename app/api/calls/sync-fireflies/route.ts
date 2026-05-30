// app/api/calls/sync-fireflies/route.ts
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import {
  fetchTranscriptsByDate,
  filterAnalyzableTranscripts,
  buildTranscriptText,
  extractSpeakerNames,
  formatFirefliesDuration,
  isFirefliesConfigured,
  FirefliesTranscript,
} from "@/app/lib/fireflies";
import { yesterdayInTR } from "@/app/lib/kriko";

const UNASSIGNED_EMAIL = "unassigned@estenove.local";
const UNASSIGNED_NAME = "Atanmamış";

async function getOrCreateUnassignedUser() {
  let user = await prisma.user.findUnique({ where: { email: UNASSIGNED_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: {
        name: UNASSIGNED_NAME,
        email: UNASSIGNED_EMAIL,
        passwordHash: "DISABLED",
        role: "AGENT",
      },
    });
  }
  return user;
}

/** Transcript'teki konuşmacı adlarını DB kullanıcılarıyla eşleştir */
async function matchAgentFromSpeakers(speakerNames: string[]) {
  if (speakerNames.length === 0) return null;

  const candidates = await prisma.user.findMany({
    where: { role: { in: ["AGENT", "TEAM_LEADER", "MANAGER"] } },
    select: { id: true, name: true },
  });

  const normalize = (s: string) =>
    s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

  for (const speakerName of speakerNames) {
    const norm = normalize(speakerName);
    if (!norm) continue;

    // Tam eşleşme
    for (const u of candidates) {
      if (normalize(u.name) === norm) return u;
    }

    // Kısmi eşleşme (ad + soyad)
    const parts = norm.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      for (const u of candidates) {
        const uNorm = normalize(u.name);
        if (uNorm.includes(parts[0]) && uNorm.includes(parts[1])) return u;
      }
    }

    // Tek kelimelik isim — DB'deki ismin ilk kelimesiyle karşılaştır
    if (parts.length === 1) {
      for (const u of candidates) {
        const uFirst = normalize(u.name).split(/\s+/)[0];
        if (uFirst === parts[0]) return u;
      }
    }
  }

  return null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function analyzeWithRetry(
  formData: FormData,
  baseUrl: string,
  maxRetries = 3
): Promise<{ ok: boolean; data?: any; error?: string }> {
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

async function processTranscript(transcript: FirefliesTranscript, unassignedUserId: string, baseUrl: string) {
  const externalCallId = `ff_${transcript.id}`;

  // Mükerrer kontrolü
  const existing = await prisma.evaluation.findUnique({ where: { externalCallId } });
  if (existing) return { status: "skipped" as const, reason: "already_imported" };

  const speakerNames = extractSpeakerNames(transcript.sentences);
  const matched = await matchAgentFromSpeakers(speakerNames);
  const agentId = matched?.id ?? unassignedUserId;
  const isUnassigned = !matched;

  const transcriptText = buildTranscriptText(transcript.sentences);
  const agentName = matched?.name || speakerNames[0] || "Belirtilmedi";
  const duration = formatFirefliesDuration(transcript.duration ?? 0);

  const formData = new FormData();
  formData.append("transcript", transcriptText);
  formData.append("agentName", agentName);
  formData.append("customerName", "Belirtilmedi");
  formData.append("callDuration", duration);
  formData.append("callType", "AUTO");
  formData.append("extractNames", "true");

  const result = await analyzeWithRetry(formData, baseUrl);
  if (!result.ok) {
    return { status: "failed" as const, reason: `analyze_error: ${result.error}` };
  }

  // LLM-extracted names — kullanıcı adı eşleşmesi için fallback
  const detectedAgentName: string = result.data.detectedAgentName || "Belirtilmedi";
  const detectedCustomerName: string = result.data.detectedCustomerName || "Belirtilmedi";

  // Eğer Fireflies metadata'sıyla eşleşme olmadıysa, LLM ismiyle tekrar dene
  let finalMatched = matched;
  let finalAgentId = agentId;
  let finalIsUnassigned = isUnassigned;

  if (!matched && detectedAgentName !== "Belirtilmedi") {
    const llmMatched = await matchAgentFromSpeakers([detectedAgentName]);
    if (llmMatched) {
      finalMatched = llmMatched;
      finalAgentId = llmMatched.id;
      finalIsUnassigned = false;
    }
  }

  const finalCustomerName = detectedCustomerName !== "Belirtilmedi" ? detectedCustomerName : "Belirtilmedi";
  const finalAgentName = finalMatched?.name || detectedAgentName || speakerNames[0] || "Belirtilmedi";

  const report = result.data.report || "";
  const score = result.data.score || 0;
  const callType = result.data.callType || "SECOND_CALL";
  const promptId = result.data.promptId || null;
  const weakCriteria = result.data.weakCriteria ?? null;
  const sectionScores = result.data.sectionScores ?? null;

  const evaluation = await prisma.evaluation.create({
    data: {
      agentId: finalAgentId,
      customerName: finalCustomerName,
      callDuration: duration,
      transcript: transcriptText,
      report,
      score,
      callType: callType as any,
      promptId,
      callDate: new Date(transcript.date),
      externalCallId,
      externalAgentName: speakerNames[0] || detectedAgentName || null,
      unassigned: finalIsUnassigned,
      source: "FIREFLIES",
      recordingUrl: `https://app.fireflies.ai/view/${transcript.id}`,
      weakCriteria,
      sectionScores,
    },
  });

  if (!finalIsUnassigned) {
    const agent = await prisma.user.findUnique({ where: { id: finalAgentId }, select: { teamId: true } });
    const notifyIds: string[] = [finalAgentId];
    if (agent?.teamId) {
      const team = await prisma.team.findUnique({ where: { id: agent.teamId }, select: { leaderId: true } });
      if (team?.leaderId) notifyIds.push(team.leaderId);
    }
    await prisma.notification.createMany({
      data: notifyIds.map(uid => ({
        userId: uid,
        type: "EVALUATION",
        message: `${finalCustomerName} için değerlendirme tamamlandı. Skor: %${score}`,
        referenceId: evaluation.id,
      })),
      skipDuplicates: true,
    });
  }

  return {
    status: finalIsUnassigned ? "unassigned" as const : "imported" as const,
    agentName: finalAgentName,
  };
}

async function notifyAdminsOfUnassigned(count: number) {
  if (count === 0) return;
  const admins = await prisma.user.findMany({
    where: { role: "ADMIN" },
    select: { id: true },
  });
  await prisma.notification.createMany({
    data: admins.map(a => ({
      userId: a.id,
      type: "UNASSIGNED_CALL",
      message: `Fireflies'tan ${count} çağrı çekildi ancak danışman eşleşmesi bulunamadı. Lütfen manuel atama yapın.`,
    })),
  });
}

/** POST: belirli bir tarihi senkronize et (default: bugün) */
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  return runSync(req, "MANUAL");
}

/** GET: son sync logları + atanmamış sayısı. ?debug=true ile ham veri özeti döndürür. */
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get("debug") === "true") {
    if (!isFirefliesConfigured()) {
      return NextResponse.json({ error: "Fireflies yapılandırılmamış." }, { status: 500 });
    }
    const date = searchParams.get("date") || yesterdayInTR();
    try {
      const transcripts = await fetchTranscriptsByDate(date);
      const analyzable = filterAnalyzableTranscripts(transcripts);
      return NextResponse.json({
        date,
        total: transcripts.length,
        analyzable: analyzable.length,
        skipped: transcripts.length - analyzable.length,
        sample: transcripts.slice(0, 3).map(t => ({
          id: t.id, title: t.title, duration: t.duration,
          sentences: t.sentences.length, date: new Date(t.date).toISOString(),
        })),
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  const logs = await prisma.syncLog.findMany({
    where: { source: "FIREFLIES" },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  const unassignedCount = await prisma.evaluation.count({
    where: { unassigned: true, source: "FIREFLIES" },
  });

  return NextResponse.json({
    configured: isFirefliesConfigured(),
    logs,
    unassignedCount,
  });
}

/** Sync çekirdeği — hem POST hem cron tarafından çağrılır */
export async function runSync(req: NextRequest, trigger: "MANUAL" | "CRON") {
  let body: any = {};
  try { body = await req.json(); } catch {}

  const date = body.date || yesterdayInTR();

  if (!isFirefliesConfigured()) {
    return NextResponse.json(
      { error: "Fireflies API yapılandırılmamış (FIREFLIES_API_KEY eksik)." },
      { status: 500 }
    );
  }

  const log = await prisma.syncLog.create({
    data: { source: "FIREFLIES", date, trigger },
  });

  try {
    const host = req.headers.get("host") ?? "localhost:3000";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${host.includes("localhost") ? "http" : "https"}://${host}`;
    const transcripts = await fetchTranscriptsByDate(date);
    const analyzable = filterAnalyzableTranscripts(transcripts);
    const unassignedUser = await getOrCreateUnassignedUser();

    let imported = 0, skipped = 0, unassigned = 0, failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < analyzable.length; i++) {
      const result = await processTranscript(analyzable[i], unassignedUser.id, baseUrl);
      if (result.status === "imported") imported++;
      else if (result.status === "unassigned") { imported++; unassigned++; }
      else if (result.status === "skipped") skipped++;
      else { failed++; errors.push(`${analyzable[i].id}: ${result.reason}`); }
      if (i < analyzable.length - 1) await sleep(12000);
    }

    skipped += transcripts.length - analyzable.length;

    if (unassigned > 0) await notifyAdminsOfUnassigned(unassigned);

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        totalFetched: transcripts.length,
        imported,
        skipped,
        unassigned,
        failed,
        error: errors.length ? errors.slice(0, 5).join("; ") : null,
      },
    });

    return NextResponse.json({
      success: true,
      date,
      totalFetched: transcripts.length,
      analyzable: analyzable.length,
      imported,
      skipped,
      unassigned,
      failed,
      errors: errors.slice(0, 10),
    });
  } catch (e: any) {
    await prisma.syncLog.update({
      where: { id: log.id },
      data: { finishedAt: new Date(), error: e.message },
    });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
