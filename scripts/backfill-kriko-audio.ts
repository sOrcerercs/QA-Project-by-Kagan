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
  const trDate = (d: Date) => new Date(d.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const evals: { id: string; externalCallId: string | null; callDate: Date; recordingUrl: string | null }[] =
    await prisma.evaluation.findMany({
      where: { source: "KRIKO" },
      select: { id: true, externalCallId: true, callDate: true, recordingUrl: true },
    });
  const targets = evals.filter((e) => e.externalCallId && !isDealUrl(e.recordingUrl));
  console.log(`KRIKO evals: ${evals.length} | missing/needs-fix (target): ${targets.length}`);

  const byDate = new Map<string, typeof targets>();
  for (const e of targets) {
    const d = trDate(e.callDate);
    const list = byDate.get(d) ?? [];
    list.push(e);
    byDate.set(d, list);
  }
  console.log(`distinct dates to fetch from Kriko: ${byDate.size}`);

  let fixable = 0, noDeal = 0, notFound = 0, updated = 0;
  for (const [date, group] of byDate) {
    let calls: any[];
    try {
      calls = (await fetchCallsByDate(date)).calls;
    } catch (err: any) {
      console.warn(`  ${date}: Kriko fetch failed (${err?.message}); ${group.length} rows skipped`);
      notFound += group.length;
      await sleep(300);
      continue;
    }
    const byId = new Map<string, any>(calls.map((c) => [c.id, c]));
    for (const e of group) {
      const call = byId.get(e.externalCallId!);
      if (!call) { notFound++; continue; }
      if (!call.deal_id) { noDeal++; continue; }
      fixable++;
      if (APPLY) {
        await prisma.evaluation.update({ where: { id: e.id }, data: { recordingUrl: dealUrl(call.deal_id) } });
        updated++;
      }
    }
    await sleep(300);
  }

  console.log(`\n--- Summary ---`);
  console.log(`fixable (deal_id found in Kriko): ${fixable}`);
  console.log(`no deal_id on Kriko call (no audio possible): ${noDeal}`);
  console.log(`call id not found in Kriko for its date (no audio possible): ${notFound}`);
  console.log(APPLY ? `APPLIED: updated ${updated} rows.` : `DRY-RUN — no writes. Re-run with --apply to update ${fixable} rows.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
