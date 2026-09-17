import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { firefliesExternalCallId } from "@/app/lib/firefliesLink";
import { buildExistsResult } from "@/app/lib/existsResult";

/**
 * Tek istekte sorulabilecek en fazla id.
 *
 * Uç iç anahtarla korunuyor ama çağıran başka bir program; kazara bir günün
 * tüm id'lerini göndermesi sınırsız bir IN sorgusuna dönerdi. Sessizce
 * kırpmak yerine 400 dönüyoruz — çağıran neyin olmadığını bilsin.
 */
export const MAX_IDS = 500;

export async function POST(req: NextRequest) {
  const expected = process.env.INTERNAL_API_KEY;
  if (!expected) {
    console.error("[exists] INTERNAL_API_KEY yapılandırılmamış");
    return NextResponse.json({ error: "Sunucu yapılandırma hatası." }, { status: 500 });
  }
  if (req.headers.get("x-internal-key") !== expected) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Geçersiz istek gövdesi." }, { status: 400 });
  }

  const firefliesIds =
    body && typeof body === "object"
      ? (body as Record<string, unknown>).fireflies_ids
      : undefined;
  if (!Array.isArray(firefliesIds) || firefliesIds.length === 0) {
    return NextResponse.json({ results: {} });
  }

  if (firefliesIds.length > MAX_IDS) {
    return NextResponse.json(
      { error: `En fazla ${MAX_IDS} id sorulabilir; ${firefliesIds.length} gönderildi.` },
      { status: 400 },
    );
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
