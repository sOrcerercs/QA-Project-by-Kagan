// Hakkı tükenmiş (PENDING + attempts >= DRIVE_MAX_ATTEMPTS) satırları sıfırlar.
// Otomatik değil: bir satır üç kez başarısız olduysa tekrar denemeye değip
// değmediğine bir admin karar verir — GET .../known burada DEĞİŞMİYOR, aksi
// hâlde Apps Script bu satırları "bilinmiyor" sayıp yeniden gönderir ve
// markDriveRetryable'ın kilidi bırakmama davranışıyla birleşince sınırsız bir
// yeniden deneme döngüsü doğar.
import { NextRequest, NextResponse } from "next/server";
import { getUserFromToken } from "@/app/lib/auth";
import { requeueExhausted } from "@/app/lib/driveIngest";

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }

  const requeued = await requeueExhausted();
  return NextResponse.json({ requeued });
}
