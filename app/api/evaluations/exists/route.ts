import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { firefliesExternalCallId } from "@/app/lib/firefliesLink";
import { buildExistsResult } from "@/app/lib/existsResult";

export async function POST(req: NextRequest) {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) {
    console.error("[exists] INTERNAL_API_KEY yapılandırılmamış");
    return NextResponse.json({ error: "Sunucu yapılandırma hatası." }, { status: 500 });
  }
  if (req.headers.get("x-internal-key") !== expected) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const firefliesIds: unknown = body?.fireflies_ids;
  if (!Array.isArray(firefliesIds) || firefliesIds.length === 0) {
    return NextResponse.json({ results: {} });
  }

  const requestedIds = firefliesIds.filter((x): x is string => typeof x === "string");
  const keys = Array.from(
    new Set(
      requestedIds
        .map((id) => firefliesExternalCallId(id))
        .filter((k): k is string => k !== null)
    )
  );

  const found = keys.length
    ? await prisma.evaluation.findMany({
        where: { externalCallId: { in: keys } },
        select: { externalCallId: true },
      })
    : [];

  const foundIds = found
    .map((e) => e.externalCallId)
    .filter((v): v is string => v !== null);

  return NextResponse.json({ results: buildExistsResult(requestedIds, foundIds) });
}
