import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { pickCallRecording } from "@/app/lib/callRecording";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { id } = await params;

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    select: { recordingUrl: true, source: true, externalCallId: true },
  });

  if (!evaluation || evaluation.source !== "KRIKO" || !evaluation.recordingUrl) {
    return NextResponse.json({ error: "Ses kaydı bulunamadı." }, { status: 404 });
  }

  const apiKey = process.env.KRIKO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  // Step 1: fetch the recordings manifest (returns JSON with expiring signed URLs)
  let manifest: Response;
  try {
    manifest = await fetch(evaluation.recordingUrl, {
      headers: { "X-API-Key": apiKey },
    });
  } catch {
    return NextResponse.json({ error: "Ses dosyası alınamadı." }, { status: 502 });
  }

  if (!manifest.ok) {
    return NextResponse.json({ error: "Ses dosyası alınamadı." }, { status: manifest.status });
  }

  let data: { recordings?: Array<{ call_id?: string; download_url: string }> };
  try {
    data = await manifest.json();
  } catch {
    return NextResponse.json({ error: "Ses dosyası alınamadı." }, { status: 502 });
  }

  // Deal manifest'i deal'deki tüm çağrıları döndürür; bu değerlendirmenin çağrısına
  // (externalCallId === call_id) ait kaydı seç, bulunamazsa ilk kayda düş.
  const downloadUrl = pickCallRecording(data.recordings, evaluation.externalCallId)?.download_url;
  if (!downloadUrl) {
    return NextResponse.json({ error: "Ses kaydı bulunamadı." }, { status: 404 });
  }

  // Step 2: redirect browser to the signed download URL (token-authenticated, no API key needed)
  return NextResponse.redirect(downloadUrl, { status: 302 });
}
