// Sahne tablosundaki satırları panele gösterir — değerlendirmeye dönüşmeden
// önce "ne geldi, ne elendi, neden" sorusunun cevabı burada.
//
// NEDEN AYRI UÇ: transkript metni satır başına ~7-13 KB. Elli satırlık bir
// listede metinleri de taşımak yarım megabayt eder ve panel her açılışta
// bunu indirir. Liste metinsiz gelir; metin yalnızca tek bir satır için,
// kullanıcı o satıra tıkladığında çekilir. (Aynı gerekçe /api/okr/gaps'te de
// uygulanmıştı.)
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { driveRowState, DRIVE_MAX_ATTEMPTS, type DriveRowState } from "@/app/lib/driveIngest";

const VARSAYILAN_LIMIT = 50;
const AZAMI_LIMIT = 200;

/** Liste görünümünde taşınan alanlar — transkript metni YOK. */
const LISTE_ALANLARI = {
  id: true,
  sourceFileId: true,
  agentEmail: true,
  startedAt: true,
  customerName: true,
  durationSec: true,
  status: true,
  skipReason: true,
  attempts: true,
  evaluationId: true,
  error: true,
  discoveredAt: true,
  importedAt: true,
} as const;

/** `state` süzgecini Prisma koşuluna çevirir. */
function stateWhere(state: string | null): Record<string, unknown> {
  switch (state) {
    case "pending":
      return { status: "PENDING", attempts: { lt: DRIVE_MAX_ATTEMPTS } };
    case "exhausted":
      return { status: "PENDING", attempts: { gte: DRIVE_MAX_ATTEMPTS } };
    case "skipped":
      return { status: "SKIPPED" };
    case "imported":
      return { status: "IMPORTED" };
    default:
      return {};
  }
}

export async function GET(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const url = new URL(req.url);
  const id = url.searchParams.get("id");

  // TEK SATIR — metinle birlikte.
  if (id) {
    const row = await prisma.driveTranscript.findUnique({
      where: { id },
      select: { ...LISTE_ALANLARI, transcript: true },
    });
    if (!row) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    return NextResponse.json({ ...row, state: driveRowState(row) });
  }

  // LİSTE — metinsiz.
  const limitRaw = Number(url.searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0
    ? Math.min(Math.trunc(limitRaw), AZAMI_LIMIT)
    : VARSAYILAN_LIMIT;

  const where = stateWhere(url.searchParams.get("state"));

  const [rows, total] = await Promise.all([
    prisma.driveTranscript.findMany({
      where,
      // En yeni çağrı üstte: panel "az önce ne geldi" sorusuna bakıyor.
      orderBy: { startedAt: "desc" },
      take: limit,
      select: LISTE_ALANLARI,
    }),
    prisma.driveTranscript.count({ where }),
  ]);

  return NextResponse.json({
    total,
    rows: rows.map((r) => ({ ...r, state: driveRowState(r) as DriveRowState })),
  });
}
