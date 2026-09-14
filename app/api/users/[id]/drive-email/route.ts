// Panelden danışman atandığında Drive e-postasını da bağlar. Bu, hattın
// KENDİNİ ONARAN parçası: eşlenmeyen bir Drive e-postası bir kez elle
// atanır, sonraki çağrılar otomatik doğru danışmana gider ve yeni danışman
// için deploy gerekmez.
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";

export async function PATCH(req: NextRequest, ctx: { params: Promise<{ id: string }> }) {
  const admin = await getUserFromToken(req);
  if (!admin || admin.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const { id } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const driveEmail = typeof body?.driveEmail === "string" ? body.driveEmail.trim().toLowerCase() : "";

  // Geçersiz değer sessizce varsayılana düşmez; 400 döner.
  if (!driveEmail.includes("@") || /\s/.test(driveEmail)) {
    return NextResponse.json({ error: "Geçerli bir e-posta gerekli." }, { status: 400 });
  }

  // driveEmail UNIQUE. Çakışmayı yakalayıp anlamlı mesaj veriyoruz; yoksa
  // kullanıcı ham Prisma hatası görürdü.
  const sahip = await prisma.user.findUnique({
    where: { driveEmail },
    select: { id: true, name: true },
  });
  if (sahip && sahip.id !== id) {
    return NextResponse.json(
      { error: `Bu Drive e-postası zaten ${sahip.name} kullanıcısına bağlı.` },
      { status: 409 },
    );
  }

  const user = await prisma.user.update({
    where: { id },
    data: { driveEmail },
    select: { id: true, name: true, email: true, driveEmail: true },
  });
  return NextResponse.json({ success: true, user });
}
