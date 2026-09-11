// Faz 2: istek başına TEK satır. Döngü tarayıcıda (AdminPanel) veya cron'un
// kalan bütçesinde kurulur — deepScore kuyruğunun kalıbının aynısı.
import { NextRequest, NextResponse } from "next/server";

// DİKKAT: 300 bir DİLEK, garanti değil. Hobby'de gerçek tavan 60 sn.
export const maxDuration = 300;

import prisma from "@/app/lib/prisma";
import { CallType } from "@/app/generated/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { parseMeetTranscript, classifyMeetTranscript } from "@/app/lib/meetTranscript";
import {
  claimNextDriveTranscript,
  markDriveSkipped,
  markDriveImported,
  markDriveRetryable,
  pendingDriveWhere,
} from "@/app/lib/driveIngest";
import { shouldForceFirstCall } from "@/app/lib/evaluationRules";
import { isDuplicateCallError } from "@/app/lib/prismaErrors";
import { formatDuration } from "@/app/lib/kriko";

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

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  return processOneDriveTranscript(req);
}

export async function processOneDriveTranscript(req: NextRequest) {
  const kalan = () => prisma.driveTranscript.count({ where: pendingDriveWhere() });

  const row = await claimNextDriveTranscript();
  if (!row) return NextResponse.json({ processed: false, remaining: 0 });

  try {
    // Danışman kimliği driveEmail'den KESİN geliyor; isim eşleştirme yok.
    const agent = await prisma.user.findUnique({
      where: { driveEmail: row.agentEmail },
      select: { id: true, name: true },
    });

    const parsed = parseMeetTranscript(row.transcript);

    // Danışman driveEmail'den çözülemediğinde rol ataması için dayanak
    // kalmıyor. SKIPPED yapmıyoruz — çağrı gerçek, atılması veri kaybı olur.
    // Bunun yerine Meet'in katılımcı sırasına dayanıyoruz: gözlemlenen
    // kayıtlarda toplantıyı düzenleyen (danışman) ilk sırada geliyor.
    //
    // BU BİR TAHMİN ve öyle işaretleniyor: kayıt unassigned düşer, admine
    // bildirim gider ve error alanına tahmin notu yazılır.
    const agentKnown = agent !== null;
    const agentNameForRoles = agent?.name ?? parsed.attendees[0] ?? "";

    const verdict = classifyMeetTranscript(parsed, agentNameForRoles);
    if (!verdict.ok) {
      await markDriveSkipped(row.id, verdict.reason);
      return NextResponse.json({
        processed: true, status: "skipped", reason: verdict.reason, remaining: await kalan(),
      });
    }

    const unassignedUser = agent ? null : await getOrCreateUnassignedUser();
    const agentId = agent?.id ?? unassignedUser!.id;
    const forceFirstCall = await shouldForceFirstCall(agent?.id);
    const duration = formatDuration(parsed.durationSec ?? 0);

    const host = req.headers.get("host") ?? "localhost:3000";
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${host.includes("localhost") ? "http" : "https"}://${host}`;

    const formData = new FormData();
    formData.append("transcript", verdict.text);
    formData.append("agentName", agent?.name ?? verdict.roles.agentAttendee);
    formData.append("customerName", verdict.roles.customerAttendee);
    formData.append("callDuration", duration);
    formData.append("callType", forceFirstCall ? "FIRST_CALL" : "AUTO");
    // Adları YAPISAL olarak biliyoruz; LLM'e çıkarttırmıyoruz.
    formData.append("extractNames", "false");

    const res = await fetch(`${baseUrl}/api/analyze`, { method: "POST", body: formData });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      await markDriveRetryable(row.id, `analyze ${res.status}: ${errText.slice(0, 200)}`);
      return NextResponse.json({
        processed: true, status: "failed", reason: `analyze_${res.status}`, remaining: await kalan(),
      });
    }
    const data = await res.json();

    let evaluation;
    try {
      evaluation = await prisma.evaluation.create({
        data: {
          agentId,
          customerName: verdict.roles.customerAttendee,
          callDuration: duration,
          transcript: verdict.text,
          report: data.report || "",
          score: data.score || 0,
          callType: (data.callType || "SECOND_CALL") as CallType,
          promptId: data.promptId || null,
          callDate: row.startedAt,
          externalCallId: `gm_${row.meetFolderId}`,
          externalAgentName: row.agentEmail,
          unassigned: !agent,
          source: "GOOGLE_MEET",
          recordingUrl: `https://drive.google.com/drive/folders/${row.meetFolderId}`,
          weakCriteria: data.weakCriteria ?? null,
          sectionScores: data.sectionScores ?? null,
          reportData: data.reportData ?? null,
        },
      });
    } catch (e) {
      // Aynı çağrı başka bir yoldan yazılmış — hata değil, alınmış say.
      if (isDuplicateCallError(e)) {
        await markDriveSkipped(row.id, "already_imported");
        return NextResponse.json({
          processed: true, status: "skipped", reason: "already_imported", remaining: await kalan(),
        });
      }
      throw e;
    }

    await markDriveImported(row.id, evaluation.id);

    if (!agentKnown) {
      // Rol ataması tahmine dayandı; izini bırak ki sonradan denetlenebilsin.
      await prisma.driveTranscript.update({
        where: { id: row.id },
        data: { error: `rol_tahmini: agentEmail=${row.agentEmail} eslesmedi, ilk katilimci danisman sayildi` },
      });
    }

    if (agent) {
      const withTeam = await prisma.user.findUnique({
        where: { id: agent.id }, select: { teamId: true },
      });
      const notifyIds: string[] = [agent.id];
      if (withTeam?.teamId) {
        const team = await prisma.team.findUnique({
          where: { id: withTeam.teamId }, select: { leaderId: true },
        });
        if (team?.leaderId) notifyIds.push(team.leaderId);
      }
      await prisma.notification.createMany({
        data: notifyIds.map(uid => ({
          userId: uid,
          type: "EVALUATION",
          message: `${verdict.roles.customerAttendee} için değerlendirme tamamlandı. Skor: %${data.score || 0}`,
          referenceId: evaluation.id,
        })),
        skipDuplicates: true,
      });
    } else {
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await prisma.notification.createMany({
        data: admins.map(a => ({
          userId: a.id,
          type: "UNASSIGNED_CALL",
          message: `Google Meet'ten gelen bir çağrının danışmanı eşleşmedi (${row.agentEmail}). Lütfen manuel atama yapın.`,
        })),
      });
    }

    return NextResponse.json({
      processed: true,
      status: agent ? "imported" : "unassigned",
      evaluationId: evaluation.id,
      remaining: await kalan(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await markDriveRetryable(row.id, message).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
