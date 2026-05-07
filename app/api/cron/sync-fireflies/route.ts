import { NextRequest, NextResponse } from "next/server";
import { runSync } from "@/app/api/calls/sync-fireflies/route";
import { isFirefliesConfigured } from "@/app/lib/fireflies";

/**
 * Vercel Cron tarafından çağrılır. CRON_SECRET ile korunur.
 * vercel.json schedule: "0 2 * * *" (her gece 02:00 UTC = 05:00 TR)
 */
export async function GET(req: NextRequest) {
  const auth = req.headers.get("authorization");
  if (process.env.CRON_SECRET && auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Yetkisiz." }, { status: 401 });
  }

  if (!isFirefliesConfigured()) {
    return NextResponse.json({ error: "Fireflies yapılandırılmamış." }, { status: 500 });
  }

  return runSync(req, "CRON");
}
