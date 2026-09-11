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
  DRIVE_ANALYZE_ESTIMATE_MS,
} from "@/app/lib/driveIngest";
import { DEEP_SCORE_REQUEST_CAP_MS, DEEP_SCORE_RESERVE_MS } from "@/app/lib/rescoreStep";
import { shouldForceFirstCall } from "@/app/lib/evaluationRules";
import { isDuplicateCallError } from "@/app/lib/prismaErrors";
import { formatDuration } from "@/app/lib/kriko";

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  return processOneDriveTranscript(req);
}

export async function processOneDriveTranscript(req: NextRequest) {
  const requestStart = Date.now();
  const kalan = () => prisma.driveTranscript.count({ where: pendingDriveWhere() });

  const row = await claimNextDriveTranscript();
  if (!row) return NextResponse.json({ processed: false, remaining: await kalan() });

  try {
    // Danışman kimliği driveEmail'den KESİN geliyor; isim eşleştirme yok.
    const agent = await prisma.user.findUnique({
      where: { driveEmail: row.agentEmail },
      select: { id: true, name: true },
    });

    // Danışman driveEmail'den çözülemediğinde rol ataması için dayanak
    // kalmıyor. Eskiden katılımcı sırasına (attendees[0]) dayanan bir TAHMİN
    // yapılıp kayıt "unassigned" olarak içeri alınıyordu; ama reassign
    // ucu unassigned'ı koşulsuz temizlediğinden, admin çağrıyı doğru
    // danışmana bağladığı an tahmine dayalı Agent/Customer ayrımı
    // doğrulanmış bir puanla ayırt edilemez hâle geliyor ve o danışmanın
    // OKR'sine karışıyordu. Bunun yerine ASLA TAHMİN ETMİYORUZ: satır
    // SKIPPED'e düşer, admin driveEmail'i bağlar, Fix 1'in requeue'su
    // satırı kuyruğa geri getirir.
    if (!agent) {
      await markDriveSkipped(row.id, "agent_unresolved");
      const admins = await prisma.user.findMany({ where: { role: "ADMIN" }, select: { id: true } });
      await prisma.notification.createMany({
        data: admins.map(a => ({
          userId: a.id,
          type: "UNASSIGNED_CALL",
          message: `Google Meet'ten gelen bir çağrının danışmanı eşleşmedi (${row.agentEmail}). Drive e-postası bağlanmayı bekliyor.`,
        })),
      });
      return NextResponse.json({
        processed: true, status: "skipped", reason: "agent_unresolved", remaining: await kalan(),
      });
    }

    const parsed = parseMeetTranscript(row.transcript);

    const verdict = classifyMeetTranscript(parsed, agent.name);
    if (!verdict.ok) {
      await markDriveSkipped(row.id, verdict.reason);
      return NextResponse.json({
        processed: true, status: "skipped", reason: verdict.reason, remaining: await kalan(),
      });
    }

    const agentId = agent.id;
    const forceFirstCall = await shouldForceFirstCall(agent.id);
    // durationSec bilinmiyorsa (transkriptte "Meeting ended after" satırı yok)
    // formatDuration(0) uydurma bir "0:00" üretirdi ve bu, puanlama
    // rubriğine çağrının süresiymiş gibi geçerdi. Bilinmiyorsa dürüstçe
    // "Belirtilmedi" geç — kod tabanının bu yol için zaten kullandığı kural.
    const duration = parsed.durationSec != null ? formatDuration(parsed.durationSec) : "Belirtilmedi";

    const host = req.headers.get("host") ?? "localhost:3000";
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${host.includes("localhost") ? "http" : "https"}://${host}`;

    const formData = new FormData();
    formData.append("transcript", verdict.text);
    formData.append("agentName", agent.name);
    formData.append("customerName", verdict.roles.customerAttendee);
    formData.append("callDuration", duration);
    formData.append("callType", forceFirstCall ? "FIRST_CALL" : "AUTO");
    // Adları YAPISAL olarak biliyoruz; LLM'e çıkarttırmıyoruz.
    formData.append("extractNames", "false");

    // /api/analyze kendi Gemini çağrısını (callGemini) sınırlamıyor: kütüphane
    // varsayılanı 429'da 5 denemeye kadar bekleyebiliyor ve bu tek satırı 60 sn
    // Hobby tavanının üstüne taşıyabiliyor. Tavan aşılınca platform isteği
    // SESSİZCE keser, catch hiç çalışmaz, kilit 5 dk boyunca tutulur ve bir
    // deneme hakkı boşuna yanar. Bu yüzden zaman aşımını BURADAN, kalan
    // bütçeden türeterek koyuyoruz — sabit bir sayı yazmıyoruz ve satırın
    // tüm-istek tahmininin (DRIVE_ANALYZE_ESTIMATE_MS) kesinlikle altında
    // tutuyoruz.
    const kalanButce = DEEP_SCORE_REQUEST_CAP_MS - DEEP_SCORE_RESERVE_MS - (Date.now() - requestStart);
    const analyzeTimeoutMs = Math.max(1_000, Math.min(kalanButce, DRIVE_ANALYZE_ESTIMATE_MS - 1_000));
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), analyzeTimeoutMs);

    let res: Response;
    try {
      res = await fetch(`${baseUrl}/api/analyze`, {
        method: "POST", body: formData, signal: controller.signal,
      });
    } catch (fetchErr) {
      if (fetchErr instanceof Error && fetchErr.name === "AbortError") {
        await markDriveRetryable(row.id, `analyze ${analyzeTimeoutMs}ms icinde zaman asimina ugradi`);
        return NextResponse.json({
          processed: true, status: "failed", reason: "analyze_timeout", remaining: await kalan(),
        });
      }
      throw fetchErr;
    } finally {
      clearTimeout(timeoutId);
    }

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
          unassigned: false,
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

    // Danışman driveEmail'den KESİN çözüldüğü için (bkz. yukarıdaki
    // agent_unresolved dalı) buraya varan her satırda agent her zaman var —
    // "atanmamış" yolu artık yok.
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

    return NextResponse.json({
      processed: true,
      status: "imported",
      evaluationId: evaluation.id,
      remaining: await kalan(),
    });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : String(e);
    await markDriveRetryable(row.id, message).catch(() => {});
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
