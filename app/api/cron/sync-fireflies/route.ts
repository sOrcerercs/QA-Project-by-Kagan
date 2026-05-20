import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/app/api/calls/sync-fireflies/route";
import { isFirefliesConfigured } from "@/app/lib/fireflies";

/**
 * Vercel Cron tarafından çağrılır. CRON_SECRET ile korunur.
 * vercel.json schedule: "0 2 * * *" (her gece 02:00 UTC = 05:00 TR)
 */
export async function GET(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error("[cron/sync-fireflies] CRON_SECRET is not configured — refusing to run");
    return NextResponse.json({ error: "Sunucu yapılandırma hatası." }, { status: 500 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  if (!isFirefliesConfigured()) {
    return NextResponse.json({ error: "Fireflies yapılandırılmamış." }, { status: 500 });
  }

  return runSync(req, "CRON");
}
