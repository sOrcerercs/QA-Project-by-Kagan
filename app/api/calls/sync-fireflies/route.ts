// app/api/calls/sync-fireflies/route.ts
import { NextRequest, NextResponse } from "next/server";
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
import { todayInTR } from "@/app/lib/kriko";

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
      if (
        (r.status === 429 || (r.status === 500 && errText.includes("Rate limit"))) &&
        attempt < maxRetries - 1
      ) {
        await sleep(5000 * Math.pow(2, attempt));
        continue;
      }
      return { ok: false, error: `${r.status} ${errText.slice(0, 100)}` };
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
  const duration = formatFirefliesDuration(transcript.duration);

  const formData = new FormData();
  formData.append("transcript", transcriptText);
  formData.append("agentName", agentName);
  formData.append("customerName", "Belirtilmedi");
  formData.append("callDuration", duration);
  formData.append("callType", "AUTO");

  const result = await analyzeWithRetry(formData, baseUrl);
  if (!result.ok) {
    return { status: "failed" as const, reason: `analyze_error: ${result.error}` };
  }

  const report = result.data.report || "";
  const score = result.data.score || 0;
  const callType = result.data.callType || "SECOND_CALL";
  const promptId = result.data.promptId || null;

  await prisma.evaluation.create({
    data: {
      agentId,
      customerName: "Belirtilmedi",
      callDuration: duration,
      transcript: transcriptText,
      report,
      score,
      callType: callType as any,
      promptId,
      callDate: new Date(transcript.date),
      externalCallId,
      externalAgentName: speakerNames[0] || null,
      unassigned: isUnassigned,
      source: "FIREFLIES",
    },
  });

  return {
    status: isUnassigned ? "unassigned" as const : "imported" as const,
    agentName,
  };
}

async function notifyAdminsOfUnassigned(count: number) {
  if (count === 0) return;
  const admins = await prisma.user.findMany({
    where: { role: { in: ["ADMIN", "MANAGER"] } },
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
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  return runSync(req, "MANUAL");
}

/** GET: son sync logları + atanmamış sayısı */
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || !["ADMIN", "MANAGER"].includes(user.role)) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
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

  const date = body.date || todayInTR();

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
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get("host")}`;
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
      if (i < analyzable.length - 1) await sleep(3000);
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
