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
import { driveRowState, checkDriveEmailAssignment, DRIVE_MAX_ATTEMPTS, type DriveRowState } from "@/app/lib/driveIngest";

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

/**
 * Elle danışman atama.
 *
 * Kimlik çözümü BİLEREK kapalı devre: driveEmail bir danışmana bağlı
 * değilse satır tahmin edilmeden elenir (bkz. ingest-meet/next). Bu uç,
 * o kararın insan tarafındaki karşılığı — admin hangi danışman olduğunu
 * söyler, eşleme kurulur ve satır kuyruğa geri konur.
 *
 * Eşlemeyi KALICI kuruyoruz (User.driveEmail): aynı Google hesabından gelen
 * sonraki çağrılar bir daha elle atama istemesin. Bu yüzden üzerine yazma
 * koruması var — bkz. checkDriveEmailAssignment.
 */
export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const id = typeof body?.id === "string" ? body.id : null;
  const agentId = typeof body?.agentId === "string" ? body.agentId : null;
  if (!id || !agentId) {
    return NextResponse.json({ error: "id ve agentId zorunlu." }, { status: 400 });
  }

  const row = await prisma.driveTranscript.findUnique({
    where: { id },
    select: { id: true, agentEmail: true, status: true, evaluationId: true },
  });
  if (!row) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });

  // Alınmış satırı elle atamak yanlış kapı: değerlendirme zaten oluşmuş,
  // danışmanı değiştirmek o kaydın üzerinden yapılır.
  if (row.status === "IMPORTED") {
    return NextResponse.json(
      { error: "Bu çağrı zaten değerlendirmeye dönüşmüş; danışmanı değerlendirme sayfasından değiştir." },
      { status: 409 },
    );
  }

  const [agent, emailOwner] = await Promise.all([
    prisma.user.findUnique({ where: { id: agentId }, select: { id: true, name: true, driveEmail: true } }),
    prisma.user.findUnique({ where: { driveEmail: row.agentEmail }, select: { id: true, name: true } }),
  ]);
  if (!agent) return NextResponse.json({ error: "Danışman bulunamadı." }, { status: 404 });

  const verdict = checkDriveEmailAssignment({
    rowAgentEmail: row.agentEmail,
    chosenUserId: agent.id,
    chosenUserDriveEmail: agent.driveEmail,
    emailOwnerUserId: emailOwner?.id ?? null,
  });

  if (!verdict.ok) {
    const mesaj = verdict.reason === "email_taken_by_other"
      ? `${row.agentEmail} adresi zaten ${emailOwner?.name ?? "başka bir danışmana"} bağlı.`
      : `${agent.name} zaten ${agent.driveEmail} adresine bağlı. Önce o bağlantıyı kaldır.`;
    return NextResponse.json({ error: mesaj, reason: verdict.reason }, { status: 409 });
  }

  if (verdict.bindEmail) {
    await prisma.user.update({ where: { id: agent.id }, data: { driveEmail: row.agentEmail } });
  }

  // Satırı kuyruğa geri koy: eleme sebebi, deneme sayacı ve kilit sıfırlanır.
  await prisma.driveTranscript.update({
    where: { id: row.id },
    data: { status: "PENDING", skipReason: null, attempts: 0, lockedAt: null, error: null },
  });

  return NextResponse.json({
    ok: true,
    agentName: agent.name,
    bound: verdict.bindEmail,
    driveEmail: row.agentEmail,
  });
}
