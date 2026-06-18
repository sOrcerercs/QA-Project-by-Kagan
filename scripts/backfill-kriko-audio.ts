// scripts/backfill-kriko-audio.ts
// One-off maintenance: recompute recordingUrl for KRIKO evaluations whose audio
// is missing (null or not a /api/deals/.../audio manifest URL), by re-fetching
// Kriko calls per date and mapping externalCallId -> deal_id.
//   npx tsx scripts/backfill-kriko-audio.ts          # dry-run (no writes)
//   npx tsx scripts/backfill-kriko-audio.ts --apply  # writes recordingUrl
//
// Standalone: loads .env.local/.env itself and builds its own Prisma client
// (the app's app/lib/prisma uses a "@/" alias tsx won't resolve).
import * as fs from "fs";
import * as path from "path";

function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), f);
    if (!fs.existsSync(p)) continue;
    for (const raw of fs.readFileSync(p, "utf8").split("\n")) {
      const m = raw.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/);
      if (!m) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  loadEnv();
  const APPLY = process.argv.includes("--apply");
  const BASE = process.env.KRIKO_API_BASE;
  if (!BASE) throw new Error("KRIKO_API_BASE missing (is .env.local present?).");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing.");

  const { PrismaClient } = await import("../app/generated/prisma");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { fetchCallsByDate } = await import("../app/lib/kriko");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) } as any);

  const dealUrl = (dealId: string) => `${BASE}/api/deals/${dealId}/audio`;
  const isDealUrl = (u: string | null) => !!u && u.startsWith(`${BASE}/api/deals/`);
  const ymd = (d: Date) => d.toISOString().slice(0, 10);

  const evals: { id: string; externalCallId: string | null; callDate: Date; recordingUrl: string | null }[] =
    await prisma.evaluation.findMany({
      where: { source: "KRIKO" },
      select: { id: true, externalCallId: true, callDate: true, recordingUrl: true },
    });
  const targets = evals.filter((e) => e.externalCallId && !isDealUrl(e.recordingUrl));
  console.log(`KRIKO evals: ${evals.length} | missing/needs-fix (target): ${targets.length}`);

  // Kriko çağrıları UTC gününe göre gruplar; callDate'i TR'ye (+3s) çevirip tek gün
  // çekmek 21:00–24:00 UTC (gece yarısı TR) çağrılarını yanlış güne kaydırıp kaçırır.
  // Her hedef için UTC günü ±1'i adaylara ekle, hepsini tek sefer çekip global id->call
  // haritası kur. Böylece gün-sınırı çağrıları da bulunur.
  const candidateDates = new Set<string>();
  for (const e of targets) {
    const t = e.callDate.getTime();
    for (const off of [-1, 0, 1]) candidateDates.add(ymd(new Date(t + off * 86400000)));
  }
  console.log(`distinct dates to fetch from Kriko: ${candidateDates.size}`);

  const byId = new Map<string, any>();
  const failedDates: string[] = [];
  for (const date of candidateDates) {
    try {
      for (const c of (await fetchCallsByDate(date)).calls) byId.set(c.id, c);
    } catch (err: any) {
      console.warn(`  ${date}: Kriko fetch failed (${err?.message})`);
      failedDates.push(date);
    }
    await sleep(300);
  }

  let fixable = 0, noDeal = 0, notFound = 0, updated = 0;
  for (const e of targets) {
    const call = byId.get(e.externalCallId!);
    if (!call) { notFound++; continue; }
    if (!call.deal_id) { noDeal++; continue; }
    fixable++;
    if (APPLY) {
      await prisma.evaluation.update({ where: { id: e.id }, data: { recordingUrl: dealUrl(call.deal_id) } });
      updated++;
    }
  }
  if (failedDates.length) console.log(`(note: ${failedDates.length} date fetch(es) failed; some rows may be undercounted)`);

  console.log(`\n--- Summary ---`);
  console.log(`fixable (deal_id found in Kriko): ${fixable}`);
  console.log(`no deal_id on Kriko call (no audio possible): ${noDeal}`);
  console.log(`call id not found in Kriko for its date (no audio possible): ${notFound}`);
  console.log(APPLY ? `APPLIED: updated ${updated} rows.` : `DRY-RUN — no writes. Re-run with --apply to update ${fixable} rows.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
