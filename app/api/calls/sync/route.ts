import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export const maxDuration = 300;
import {
  fetchCallsByDate,
  filterAnalyzableCalls,
  yesterdayInTR,
  isKrikoConfigured,
} from "@/app/lib/kriko";
import {
  getOrCreateUnassignedUser,
  processCall,
} from "@/app/lib/krikoSync";

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
      // Rate limit reaktif olarak callGemini (429 retry) + analyzeWithRetry katmanlarında yönetiliyor;
      // eski Groq için konulan 12sn proaktif uyku kaldırıldı (websitesinden manuel sync timeout'a takılıyordu).
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
