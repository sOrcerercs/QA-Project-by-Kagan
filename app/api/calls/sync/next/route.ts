import { NextRequest, NextResponse } from "next/server";
import prisma from "@/app/lib/prisma";
import { getUserFromToken } from "@/app/lib/auth";
import {
  fetchCallsByDate,
  filterAnalyzableCalls,
  yesterdayInTR,
  isKrikoConfigured,
} from "@/app/lib/kriko";
import { getOrCreateUnassignedUser, processCall } from "@/app/lib/krikoSync";

/**
 * Kriko senkronizasyonunun PARÇALI hâli: her istek TEK çağrı işler.
 *
 * NEDEN VAR — ölçüldü (prod, tamamlanmış koşulardan türetildi):
 * bir çağrının alınması ~20.7 sn ve bunun neredeyse tamamı Gemini analizi
 * (643 sn / 31 çağrı; 580/15; 983/31 — hepsi 15-24 sn aralığında). Vercel
 * Hobby tavanı 60 sn olduğu için toplu sync TAVANI AŞIYOR ve gece cron'u
 * iki gecedir hiç bitmiyordu (SyncLog'da finishedAt boş).
 *
 * Aynı desen kuyrukta zaten çalışıyor: /api/calls/ingest-meet/next ve
 * /api/evaluations/rescore/next. Döngü TARAYICIDA kurulur; her istek bir
 * adım atar ve kalanı bildirir.
 *
 * YENİ TABLO YOK. "Kuyruk" Kriko'nun o güne ait çağrı listesi; hangilerinin
 * alındığı mevcut `externalCallId` unique index'inden tek sorguyla okunur.
 * Bu yüzden uç durumsuz ve yeniden çalıştırılabilir: yarıda kesilirse
 * düğmeye tekrar basmak kaldığı yerden devam ettirir.
 */

export const maxDuration = 60;

interface Body {
  date?: string;
  /**
   * İstemcinin bu turda ARTIK SORMAYACAĞI çağrı id'leri.
   *
   * NEDEN GEREKLİ: processCall bazı çağrıları kalıcı olarak atlıyor
   * (transkript yok, analiz hatası). Onlar hiçbir zaman `alinmis` kümesine
   * girmediği için, liste her turda yeniden kurulduğunda yine sıranın
   * başında olurlardı ve döngü aynı çağrıyı sonsuza kadar döverdi.
   *
   * İstemci işlediği HER çağrıyı buraya ekler. Böylece her tur adaylardan
   * tam olarak birini düşürür ve döngünün bitmesi garanti olur.
   */
  skip?: string[];
}

export async function POST(req: NextRequest) {
  const user = await getUserFromToken(req);
  if (!user || user.role !== "ADMIN") {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 403 });
  }
  if (!isKrikoConfigured()) {
    return NextResponse.json({ error: "Kriko API yapılandırılmamış." }, { status: 500 });
  }

  let body: Body = {};
  try {
    body = (await req.json()) as Body;
  } catch {
    // Gövdesiz istek geçerli: tarih verilmezse dünü işler.
  }
  const date = body.date || yesterdayInTR();

  try {
    const data = await fetchCallsByDate(date);
    const analyzable = filterAnalyzableCalls(data.calls, 120);

    if (analyzable.length === 0) {
      return NextResponse.json({ processed: false, remaining: 0, date, analyzable: 0 });
    }

    // Hangi çağrıların zaten alındığı TEK sorguyla okunur. Eski toplu yol
    // bunu çağrı başına ayrı findUnique ile yapıyordu; ölçüldü, 200 çağrı
    // için 17,4 sn — aynı bilgi tek findMany ile 82 ms.
    const ids = analyzable.map((c) => c.id);
    const mevcut = await prisma.evaluation.findMany({
      where: { externalCallId: { in: ids } },
      select: { externalCallId: true },
    });
    const alinmis = new Set(mevcut.map((e) => e.externalCallId));

    const atlanacak = new Set(Array.isArray(body.skip) ? body.skip : []);
    const kalanlar = analyzable.filter((c) => !alinmis.has(c.id) && !atlanacak.has(c.id));
    if (kalanlar.length === 0) {
      return NextResponse.json({
        processed: false,
        remaining: 0,
        date,
        analyzable: analyzable.length,
      });
    }

    const host = req.headers.get("host") ?? "localhost:3000";
    const baseUrl =
      process.env.NEXT_PUBLIC_APP_URL ||
      `${host.includes("localhost") ? "http" : "https"}://${host}`;

    const unassignedUser = await getOrCreateUnassignedUser();
    const hedef = kalanlar[0];
    const r = await processCall(hedef, unassignedUser.id, baseUrl);

    return NextResponse.json({
      processed: true,
      // İstemci bunu `skip` listesine ekler; her tur adaylardan tam olarak
      // birini düşürdüğü için döngü mutlaka biter.
      callId: hedef.id,
      status: r.status,
      reason: "reason" in r ? r.reason : undefined,
      agentName: "agentName" in r ? r.agentName : undefined,
      remaining: kalanlar.length - 1,
      date,
      analyzable: analyzable.length,
    });
  } catch (err) {
    console.error("[sync/next]", err);
    const message = err instanceof Error ? err.message : "bilinmeyen hata";
    return NextResponse.json({ error: `Senkronizasyon adımı başarısız: ${message}` }, { status: 500 });
  }
}
