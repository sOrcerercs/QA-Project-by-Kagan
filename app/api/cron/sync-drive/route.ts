// Vercel Cron. İtme modelinde KEŞİF YOK — Apps Script gönderiyor.
// Bu uç yalnızca Faz 2'yi kalan bütçeyle yürütür: sırayla satır işler ve
// tavana yaklaşınca KENDİSİ durur.
//
// NEDEN KENDİ DURUYOR: platform süreci öldürdüğünde `catch` HİÇ çalışmaz,
// dolayısıyla kilit bırakılmaz ve satır 5 dakika kilitli kalır — üstelik bir
// deneme hakkı boşuna yanmış olarak. canFitAnotherRow bunu önlüyor.
//
// Günde bir cron ve 60 sn tavanla bu TÜM GÜNÜ KAPATMAZ; ~2-4 satır alır.
// Geri kalanı paneldeki döngü alır.
import { NextRequest, NextResponse } from "next/server";
import { QUOTA_ERROR_CODE } from "@/app/lib/geminiQuota";

// DİKKAT: 300 bir DİLEK, garanti değil. Hobby'de gerçek tavan 60 sn.
export const maxDuration = 300;

import { processOneDriveTranscript } from "@/app/api/calls/ingest-meet/next/route";
import { canFitAnotherRow } from "@/app/lib/driveIngest";

export async function GET(req: NextRequest) {
  const t0 = Date.now();

  // Sır tanımsızsa ÇALIŞMAYI REDDET. "Sır yoksa kontrolü atla" demek, kuyruğu
  // işleyip Gemini çağıran bir ucu herkese açmak olurdu.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/sync-drive] CRON_SECRET is not configured — refusing to run");
    return NextResponse.json({ error: "Sunucu yapılandırma hatası." }, { status: 500 });
  }
  if (req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  let alinan = 0, atlanan = 0, basarisiz = 0;
  let engel: string | null = null;

  while (canFitAnotherRow(Date.now() - t0)) {
    const res = await processOneDriveTranscript(req);

    // DİKKAT: 500 yanıtın gövdesinde `processed` alanı YOKTUR. Bunu "kuyruk
    // boş" sanıp break etmek, tek bir bozuk satırın cron'u erken bitirmesine
    // yol açar. Hata ile boş kuyruk AYRI ele alınır; satırın attempts sayacı
    // zaten 3 denemeden sonra onu kuyruktan düşürür.
    if (!res.ok) {
      // ...ama KOTA bunun istisnası: satır emekli olmuyor (hakkı iade
      // ediliyor), dolayısıyla döngü aynı satırı tekrar tekrar kapıp bırakır.
      // Ölçüldü: 27 saniyede 17 boş tur. Sıradaki satır da aynı duvara
      // çarpacağı için tüm koşuyu burada bitiriyoruz.
      const govde = await res.json().catch(() => null);
      if (govde?.code === QUOTA_ERROR_CODE) {
        engel = govde.error ?? "Google AI kotası dolu.";
        break;
      }
      basarisiz++;
      continue;
    }

    const body = await res.json();
    if (!body.processed) break;                      // kuyruk gerçekten boş
    if (body.status === "imported" || body.status === "unassigned") alinan++;
    else if (body.status === "skipped") atlanan++;
    else basarisiz++;
  }

  return NextResponse.json({
    success: true,
    alinan, atlanan, basarisiz,
    ...(engel ? { engel } : {}),
    sureMs: Date.now() - t0,
  });
}
