// Meet kaydını Drive'dan çekip akıtır — Kriko'nun /audio ucuyla aynı desen:
// kimlik bilgisi SUNUCUDA kalır, kapıyı uygulamanın kendi oturumu tutar ve
// hiçbir Drive bağlantısı tarayıcıya çıkmaz.
import { NextRequest, NextResponse } from "next/server";

import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import { getDriveAccessToken, isDriveConfigured } from "@/app/lib/driveAuth";
import { extractDriveFileId } from "@/app/lib/driveFile";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await getUserFromToken(req);
  if (!user) return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });

  const { id } = await params;

  const evaluation = await prisma.evaluation.findUnique({
    where: { id },
    select: { recordingUrl: true, source: true },
  });

  const fileId = evaluation?.source === "GOOGLE_MEET"
    ? extractDriveFileId(evaluation.recordingUrl)
    : null;
  if (!fileId) {
    return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
  }

  if (!isDriveConfigured()) {
    // Yapılandırılmamış uç ASLA sessizce boş dönmez — hangi eksikten
    // olduğunu söylemeyen bir 404, saatlerce yanlış yerde aratır.
    return NextResponse.json(
      { error: "Drive erişimi yapılandırılmamış (GOOGLE_DRIVE_* değişkenleri eksik)." },
      { status: 500 },
    );
  }

  let token: string;
  try {
    token = await getDriveAccessToken();
  } catch (e) {
    console.error("[recording] Drive token alınamadı:", e);
    return NextResponse.json({ error: "Drive kimlik doğrulaması başarısız." }, { status: 502 });
  }

  // Range'i OLDUĞU GİBİ geçiriyoruz. Kayıtlar 90-429 MB; tarayıcı ses
  // oynatıcısı ileri sarmak için parça ister ve bunu desteklemezsek
  // oynatıcı ya baştan tüm dosyayı indirir ya da ileri sarılamaz.
  const range = req.headers.get("range");
  const upstream = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media&supportsAllDrives=true`,
    { headers: { Authorization: `Bearer ${token}`, ...(range ? { Range: range } : {}) } },
  ).catch(() => null);

  if (!upstream || !upstream.ok) {
    const durum = upstream?.status ?? 502;
    console.error(`[recording] Drive ${durum} — dosya ${fileId}`);
    // 404: dosya silinmiş ya da token'ın hesabı artık göremiyor.
    return NextResponse.json(
      { error: durum === 404 ? "Kayıt Drive'da bulunamadı." : "Kayıt alınamadı." },
      { status: durum === 404 ? 404 : 502 },
    );
  }

  const headers = new Headers();
  for (const h of ["content-type", "content-length", "content-range", "accept-ranges"]) {
    const v = upstream.headers.get(h);
    if (v) headers.set(h, v);
  }
  if (!headers.has("accept-ranges")) headers.set("accept-ranges", "bytes");
  // Özel içerik: ara katmanlar önbelleğe almasın.
  headers.set("cache-control", "private, max-age=0, no-store");

  return new NextResponse(upstream.body, { status: upstream.status, headers });
}
