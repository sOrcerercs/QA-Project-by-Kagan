import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export const maxDuration = 300;
import {
  fetchCallsByDate,
  filterAnalyzableCalls,
  formatDuration,
  yesterdayInTR,
  isKrikoConfigured,
  KrikoCall,
} from "@/app/lib/kriko";
import { shouldForceFirstCall } from "@/app/lib/evaluationRules";

const UNASSIGNED_EMAIL = "unassigned@estenove.local";
const UNASSIGNED_NAME = "Atanmamış";

/** "Unassigned" özel kullanıcısını bul/oluştur (kim olduğu belirsiz çağrılar için) */
async function getOrCreateUnassignedUser() {
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

/** Kriko agent_name → DB'deki User. Diakritik/case duyarsız. */
async function matchAgent(agentName: string | null) {
  if (!agentName) return null;
  const norm = agentName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (!norm) return null;

  // Tüm agent rolündeki kullanıcılarla karşılaştır
  const candidates = await prisma.user.findMany({
    where: { role: { in: ["AGENT", "TEAM_LEADER", "MANAGER"] } },
    select: { id: true, name: true },
  });

  for (const u of candidates) {
    const uNorm = u.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    if (uNorm === norm) return u;
  }
  // Kısmi eşleşme: ad + soyad içeriyorsa
  const parts = norm.split(/\s+/).filter(Boolean);
  for (const u of candidates) {
    const uNorm = u.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    if (parts.length >= 2 && uNorm.includes(parts[0]) && uNorm.includes(parts[1])) return u;
  }
  // Tek kelimelik isim eşleşmesi: DB'deki ismin ilk kelimesiyle karşılaştır
  if (parts.length === 1) {
    for (const u of candidates) {
      const uFirst = u.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().split(/\s+/)[0];
      if (uFirst === parts[0]) return u;
    }
  }
  return null;
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

/** Analyze çağrısı — 429 alırsa exponential backoff ile 3 kez dener */
async function analyzeWithRetry(formData: FormData, baseUrl: string, maxRetries = 3): Promise<{ ok: boolean; data?: any; error?: string }> {
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
async function processCall(call: KrikoCall, unassignedUserId: string, baseUrl: string) {
  // Mükerrer kontrolü
  const existing = await prisma.evaluation.findUnique({ where: { externalCallId: call.id } });
  if (existing) return { status: "skipped" as const, reason: "already_imported" };

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

  // Evaluation kaydet
  const evaluation = await prisma.evaluation.create({
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
    },
  });

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

/** Tüm admin'lere atanmamış çağrı bildirimi gönder */
async function notifyAdminsOfUnassigned(count: number) {
  if (count === 0) return;
  const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
  await prisma.notification.createMany({
    data: admins.map(a => ({
      userId: a.id,
      type: "UNASSIGNED_CALL",
      message: `Kriko'dan ${count} çağrı çekildi ancak danışman eşleşmesi bulunamadı. Lütfen manuel atama yapın.`,
    })),
  });
}

/** POST: belirli bir tarihi (default: bugün) senkronize et */
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  return runSync(req, "MANUAL");
}

/** GET: senkron durumu + son log'lar. ?debug=true ile Kriko'dan ham veriyi döndürür. */
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  if (searchParams.get("debug") === "true") {
    if (!isKrikoConfigured()) {
      return NextResponse.json({ error: "Kriko yapılandırılmamış." }, { status: 500 });
    }
    const date = searchParams.get("date") || yesterdayInTR();
    try {
      const data = await fetchCallsByDate(date);
      const statusCounts: Record<string, number> = {};
      let noTranscript = 0, shortTranscript = 0, shortDuration = 0, wouldPass = 0;
      const withTranscript: { id: string; duration_seconds: number; agent_name: string | null }[] = [];
      for (const c of data.calls) {
        statusCounts[c.status] = (statusCounts[c.status] || 0) + 1;
        if (!c.transcript?.content) noTranscript++;
        else if (c.transcript.content.trim().length <= 50) shortTranscript++;
        else if (c.duration_seconds < 120) shortDuration++;
        else wouldPass++;
        if (c.transcript?.content) withTranscript.push({ id: c.id, duration_seconds: c.duration_seconds, agent_name: c.agent_name });
      }
      return NextResponse.json({
        date,
        call_count: data.call_count,
        calls_in_array: data.calls.length,
        status_breakdown: statusCounts,
        filter_failures: { no_transcript: noTranscript, short_transcript: shortTranscript, short_duration_under_2min: shortDuration, would_pass: wouldPass },
        calls_with_transcript: withTranscript,
        duration_histogram: {
          "0-30s": data.calls.filter(c => c.duration_seconds <= 30).length,
          "31-60s": data.calls.filter(c => c.duration_seconds > 30 && c.duration_seconds <= 60).length,
          "61-119s": data.calls.filter(c => c.duration_seconds > 60 && c.duration_seconds < 120).length,
          "120s+": data.calls.filter(c => c.duration_seconds >= 120).length,
        },
        longest_calls: data.calls
          .sort((a, b) => b.duration_seconds - a.duration_seconds)
          .slice(0, 5)
          .map(c => ({ id: c.id, duration_seconds: c.duration_seconds, agent_name: c.agent_name, has_transcript: !!c.transcript?.content, transcript_len: c.transcript?.content?.length ?? 0 })),
      });
    } catch (e: any) {
      return NextResponse.json({ error: e.message }, { status: 500 });
    }
  }

  const logs = await prisma.syncLog.findMany({
    where: { source: "KRIKO" },
    orderBy: { startedAt: "desc" },
    take: 20,
  });
  const unassignedCount = await prisma.evaluation.count({ where: { unassigned: true, source: "KRIKO" } });

  return NextResponse.json({
    configured: isKrikoConfigured(),
    logs,
    unassignedCount,
  });
}

/** Senkron çekirdeği — hem manuel hem cron tarafından çağrılır */
export async function runSync(req: NextRequest, trigger: "MANUAL" | "CRON") {
  let body: any = {};
  try { body = await req.json(); } catch {}
  const date = body.date || yesterdayInTR();

  if (!isKrikoConfigured()) {
    return NextResponse.json({ error: "Kriko API yapılandırılmamış (.env.local)." }, { status: 500 });
  }

  // Log oluştur
  const log = await prisma.syncLog.create({
    data: { source: "KRIKO", date, trigger },
  });

  try {
    const host = req.headers.get("host") ?? "localhost:3000";
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `${host.includes("localhost") ? "http" : "https"}://${host}`;

    const data = await fetchCallsByDate(date);
    const analyzable = filterAnalyzableCalls(data.calls, 120);

    const unassignedUser = await getOrCreateUnassignedUser();

    let imported = 0, skipped = 0, unassigned = 0, failed = 0;
    const errors: string[] = [];

    for (let i = 0; i < analyzable.length; i++) {
      const call = analyzable[i];
      const result = await processCall(call, unassignedUser.id, baseUrl);
      if (result.status === "imported") imported++;
      else if (result.status === "unassigned") { imported++; unassigned++; }
      else if (result.status === "skipped") skipped++;
      else { failed++; errors.push(`${call.id}: ${result.reason}`); }
      // Groq 70b rate limit koruması: dakikada 6000 token, büyük transkriptler için 12sn bekle
      if (i < analyzable.length - 1) await sleep(12000);
    }

    // Filtreden geçemeyenler skip sayısına eklensin
    skipped += data.calls.length - analyzable.length;

    if (unassigned > 0) await notifyAdminsOfUnassigned(unassigned);

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        totalFetched: data.call_count,
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
      totalFetched: data.call_count,
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
