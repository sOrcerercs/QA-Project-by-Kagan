import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 300;
import prisma from "@/app/lib/prisma";
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

async function getOrCreateUnassignedUser() {
  let user = await prisma.user.findUnique({ where: { email: UNASSIGNED_EMAIL } });
  if (!user) {
    user = await prisma.user.create({
      data: { name: UNASSIGNED_NAME, email: UNASSIGNED_EMAIL, passwordHash: "DISABLED", role: "AGENT" },
    });
  }
  return user;
}

async function matchAgent(agentName: string | null) {
  if (!agentName) return null;
  const norm = agentName.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
  if (!norm) return null;

  const candidates = await prisma.user.findMany({
    where: { role: { in: ["AGENT", "TEAM_LEADER", "MANAGER"] } },
    select: { id: true, name: true },
  });
  for (const u of candidates) {
    const uNorm = u.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    if (uNorm === norm) return u;
  }
  const parts = norm.split(/\s+/).filter(Boolean);
  for (const u of candidates) {
    const uNorm = u.name.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
    if (parts.length >= 2 && uNorm.includes(parts[0]) && uNorm.includes(parts[1])) return u;
  }
  return null;
}

async function processCall(call: KrikoCall, unassignedUserId: string, baseUrl: string) {
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
    return { status: "skipped" as const };
  }

  const matched = await matchAgent(call.agent_name);
  const agentId = matched?.id ?? unassignedUserId;
  const isUnassigned = !matched;

  const transcript = call.transcript?.content ?? "";
  if (transcript.length < 50) return { status: "skipped" as const };

  const forceFirstCall = await shouldForceFirstCall(matched?.id);

  const formData = new FormData();
  formData.append("transcript", transcript);
  formData.append("agentName", call.agent_name || "Belirtilmedi");
  formData.append("customerName", call.customer_name || "Belirtilmedi");
  formData.append("callDuration", formatDuration(call.duration_seconds));
  formData.append("callType", forceFirstCall ? "FIRST_CALL" : "AUTO");

  let report = "", score = 0, callType = "SECOND_CALL", promptId: string | null = null;
  // Retry up to 3 times with exponential backoff (Groq rate limit koruması)
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const r = await fetch(`${baseUrl}/api/analyze`, { method: "POST", body: formData });
      if (r.ok) {
        const d = await r.json();
        report = d.report || ""; score = d.score || 0;
        callType = d.callType || "SECOND_CALL"; promptId = d.promptId || null;
        break;
      }
      const errText = await r.text().catch(() => "");
      if ((r.status === 429 || (r.status === 500 && errText.includes("Rate limit"))) && attempt < 2) {
        await new Promise(rs => setTimeout(rs, 5000 * Math.pow(2, attempt)));
        continue;
      }
      if (attempt === 2) return { status: "failed" as const };
    } catch {
      if (attempt === 2) return { status: "failed" as const };
      await new Promise(rs => setTimeout(rs, 3000));
    }
  }

  await prisma.evaluation.create({
    data: {
      agentId,
      customerName: call.customer_name || "Bilinmiyor",
      callDuration: formatDuration(call.duration_seconds),
      transcript, report, score,
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
    },
  });

  return { status: isUnassigned ? "unassigned" as const : "imported" as const };
}

/**
 * Vercel Cron tarafından çağrılır. CRON_SECRET ile korunur.
 * vercel.json'daki schedule: "*​/30 * * * *" (her 30 dakikada bir)
 */
export async function GET(req: NextRequest) {
  // CRON_SECRET kontrolü — Vercel cron header'ında "Authorization: Bearer <CRON_SECRET>" gönderir
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/sync-calls] CRON_SECRET is not configured — refusing to run");
    return NextResponse.json({ error: "Sunucu yapılandırma hatası." }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  if (!isKrikoConfigured()) {
    return NextResponse.json({ error: "Kriko yapılandırılmamış." }, { status: 500 });
  }

  const date = yesterdayInTR();
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || `https://${req.headers.get("host")}`;

  const log = await prisma.syncLog.create({
    data: { source: "KRIKO", date, trigger: "CRON" },
  });

  try {
    const data = await fetchCallsByDate(date);
    const analyzable = filterAnalyzableCalls(data.calls, 120);
    const unassignedUser = await getOrCreateUnassignedUser();

    let imported = 0, skipped = data.calls.length - analyzable.length, unassigned = 0, failed = 0;
    for (let i = 0; i < analyzable.length; i++) {
      const r = await processCall(analyzable[i], unassignedUser.id, baseUrl);
      if (r.status === "imported") imported++;
      else if (r.status === "unassigned") { imported++; unassigned++; }
      else if (r.status === "skipped") skipped++;
      else failed++;
      if (i < analyzable.length - 1) await new Promise(rs => setTimeout(rs, 12000));
    }

    if (unassigned > 0) {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await prisma.notification.createMany({
        data: admins.map(a => ({
          userId: a.id,
          type: "UNASSIGNED_CALL",
          message: `Otomatik senkron: ${unassigned} çağrı için danışman eşleşmesi bulunamadı.`,
        })),
      });
    }

    await prisma.syncLog.update({
      where: { id: log.id },
      data: {
        finishedAt: new Date(),
        totalFetched: data.call_count,
        imported, skipped, unassigned, failed,
      },
    });

    return NextResponse.json({ ok: true, date, imported, unassigned, skipped, failed });
  } catch (e: any) {
    await prisma.syncLog.update({ where: { id: log.id }, data: { finishedAt: new Date(), error: e.message } });
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
