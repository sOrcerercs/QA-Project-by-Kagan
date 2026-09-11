// Apps Script'in gönderdiği Meet transkriptini alır (Faz 1).
// Gemini çağrılmaz; yalnızca DriveTranscript satırı yazılır.
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { checkIngestAuth, isIngestConfigured } from "@/app/lib/ingestAuth";
import { parseIngestPayload } from "@/app/lib/ingestPayload";
import { parseMeetTranscript } from "@/app/lib/meetTranscript";
import { pendingDriveWhere, DRIVE_MAX_ATTEMPTS } from "@/app/lib/driveIngest";

export async function POST(req: NextRequest) {
  const yetki = checkIngestAuth(req.headers.get("authorization"));
  if (yetki === "unconfigured") {
    return NextResponse.json({ error: "MEET_INGEST_SECRET tanımlı değil." }, { status: 500 });
  }
  if (yetki === "unauthorized") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const p = parseIngestPayload(body);
  if (!p.ok) {
    return NextResponse.json({ error: "Gövde geçersiz.", reason: p.error }, { status: 400 });
  }

  // Süre, transkriptin kendisinden okunuyor; Apps Script'in göndermesine gerek yok.
  const durationSec = parseMeetTranscript(p.value.transcript).durationSec;

  const mevcut = await prisma.driveTranscript.findUnique({
    where: { meetFolderId: p.value.meetFolderId },
    select: { id: true, status: true },
  });

  if (mevcut) {
    // Alınmış veya elenmiş bir kaydı SESSİZCE değiştirmek, üretilmiş
    // değerlendirmeyi veriyle uyumsuz hale getirirdi.
    if (mevcut.status !== "PENDING") {
      return NextResponse.json({ status: "already", state: mevcut.status }, { status: 200 });
    }
    await prisma.driveTranscript.update({
      where: { id: mevcut.id },
      data: {
        sourceFileId: p.value.sourceFileId,
        agentEmail: p.value.agentEmail,
        startedAt: p.value.startedAt,
        transcript: p.value.transcript,
        durationSec,
      },
    });
    return NextResponse.json({ status: "updated" }, { status: 200 });
  }

  await prisma.driveTranscript.create({
    data: {
      meetFolderId: p.value.meetFolderId,
      sourceFileId: p.value.sourceFileId,
      agentEmail: p.value.agentEmail,
      startedAt: p.value.startedAt,
      transcript: p.value.transcript,
      durationSec,
    },
  });
  return NextResponse.json({ status: "created" }, { status: 201 });
}

/** GET: panel için durum. Admin oturumu ister (sır DEĞİL). */
export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const [pending, skipped, imported, exhausted, unassignedCount, sonKayit] = await Promise.all([
    prisma.driveTranscript.count({ where: pendingDriveWhere() }),
    prisma.driveTranscript.count({ where: { status: "SKIPPED" } }),
    prisma.driveTranscript.count({ where: { status: "IMPORTED" } }),
    // pending + skipped + imported dışında kalan dördüncü küme: PENDING ama
    // hakkı tükenmiş. pendingDriveWhere() bunu "beklemede" saymadığı için
    // ayrı sayılmazsa panelden tamamen kaybolur (bkz. requeueExhausted).
    prisma.driveTranscript.count({ where: { status: "PENDING", attempts: { gte: DRIVE_MAX_ATTEMPTS } } }),
    prisma.evaluation.count({ where: { unassigned: true, source: "GOOGLE_MEET" } }),
    prisma.driveTranscript.findFirst({
      orderBy: { discoveredAt: "desc" },
      select: { discoveredAt: true },
    }),
  ]);

  const elenenSebepler = await prisma.driveTranscript.groupBy({
    by: ["skipReason"],
    where: { status: "SKIPPED" },
    _count: true,
  });

  return NextResponse.json({
    configured: isIngestConfigured(),
    pending, skipped, imported, exhausted, unassignedCount,
    sonKayit: sonKayit?.discoveredAt ?? null,
    elenenSebepler,
  });
}
