import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { id } = await params;

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    select: { recordingUrl: true, source: true },
  });

  if (!evaluation || evaluation.source !== "KRIKO" || !evaluation.recordingUrl) {
    return NextResponse.json({ error: "Ses kaydı bulunamadı." }, { status: 404 });
  }

  const apiKey = process.env.KRIKO_API_KEY;
  if (!apiKey) {
    return NextResponse.json({ error: "Server configuration error." }, { status: 500 });
  }

  const upstreamHeaders: HeadersInit = { "X-API-Key": apiKey };
  const rangeHeader = req.headers.get("range");
  if (rangeHeader) upstreamHeaders["Range"] = rangeHeader;

  let upstream: Response;
  try {
    upstream = await fetch(evaluation.recordingUrl, { headers: upstreamHeaders });
  } catch {
    return NextResponse.json({ error: "Ses dosyası alınamadı." }, { status: 502 });
  }

  if (!upstream.ok && upstream.status !== 206) {
    return NextResponse.json({ error: "Ses dosyası alınamadı." }, { status: upstream.status });
  }

  const responseHeaders = new Headers();
  for (const key of ["content-type", "content-length", "accept-ranges", "content-range"]) {
    const val = upstream.headers.get(key);
    if (val) responseHeaders.set(key, val);
  }
  if (!responseHeaders.get("content-type")) {
    responseHeaders.set("content-type", "audio/mpeg");
  }

  return new NextResponse(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
}
