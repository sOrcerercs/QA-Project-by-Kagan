// Apps Script'in "hangilerini zaten biliyorsun?" sorusu.
//
// NEDEN VAR: çekme modelinde her tur kutunun tamamı listeleniyordu, bir tur
// kaçsa sonraki yakalıyordu. İtme modelinde başarısız bir POST sessizce
// kaybolur — Fireflies'ta kalıcı kayıp yaratan desenin ta kendisi. Bu uç
// listeleme işini script'e taşıyarak aynı güvenceyi geri veriyor; durumun
// tek kaynağı yine veritabanı, script defter tutmuyor.
import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

import prisma from "@/app/lib/prisma";
import { checkIngestAuth } from "@/app/lib/ingestAuth";

const SINCE_RE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: NextRequest) {
  const yetki = checkIngestAuth(req.headers.get("authorization"));
  if (yetki === "unconfigured") {
    return NextResponse.json({ error: "MEET_INGEST_SECRET tanımlı değil." }, { status: 500 });
  }
  if (yetki === "unauthorized") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  const since = new URL(req.url).searchParams.get("since");
  // since ZORUNLU: sınırsız liste döndürmek tablo büyüdükçe sessizce yavaşlar.
  if (!since || !SINCE_RE.test(since)) {
    return NextResponse.json(
      { error: "since parametresi zorunlu, biçim YYYY-MM-DD." },
      { status: 400 },
    );
  }

  const rows = await prisma.driveTranscript.findMany({
    where: { startedAt: { gte: new Date(`${since}T00:00:00.000+03:00`) } },
    select: { meetFolderId: true },
  });

  return NextResponse.json({ since, meetFolderIds: rows.map(r => r.meetFolderId) });
}
