// scripts/diagnose-kriko-audio.ts  (READ-ONLY diagnostic — no DB writes)
// Gathers evidence at each boundary of the Kriko audio pipeline to locate where it breaks:
//   1) DB state: recent KRIKO evals — how many have recordingUrl null vs deal-url vs other
//   2) Kriko API shape: for recent dates, how many calls expose deal_id / recording_url
//   3) Manifest reachability: for a sample of stored deal-urls, does the manifest return download_url
//   npx tsx scripts/diagnose-kriko-audio.ts
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
  const BASE = process.env.KRIKO_API_BASE;
  const KEY = process.env.KRIKO_API_KEY;
  if (!BASE) throw new Error("KRIKO_API_BASE missing.");
  if (!KEY) throw new Error("KRIKO_API_KEY missing.");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing.");

  const { PrismaClient } = await import("../app/generated/prisma");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { fetchCallsByDate } = await import("../app/lib/kriko");

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) } as any);
  const isDealUrl = (u: string | null) => !!u && u.startsWith(`${BASE}/api/deals/`);
  const trDate = (d: Date) => new Date(d.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);

  // ===== BOUNDARY 1: DB state =====
  const since = new Date(Date.now() - 14 * 86400000);
  const evals: { id: string; externalCallId: string | null; callDate: Date; recordingUrl: string | null }[] =
    await prisma.evaluation.findMany({
      where: { source: "KRIKO", callDate: { gte: since } },
      select: { id: true, externalCallId: true, callDate: true, recordingUrl: true },
      orderBy: { callDate: "desc" },
    });
  let nullUrl = 0, dealU = 0, otherU = 0;
  for (const e of evals) {
    if (!e.recordingUrl) nullUrl++;
    else if (isDealUrl(e.recordingUrl)) dealU++;
    else otherU++;
  }
  console.log(`\n===== BOUNDARY 1: DB (KRIKO evals, last 14 days) =====`);
  console.log(`total=${evals.length}  recordingUrl: null=${nullUrl}  dealUrl=${dealU}  other=${otherU}`);
  if (evals[0]) console.log(`most recent callDate: ${evals[0].callDate.toISOString()}  url=${evals[0].recordingUrl ?? "NULL"}`);

  // ===== BOUNDARY 2: Kriko API shape for recent dates =====
  console.log(`\n===== BOUNDARY 2: Kriko API /api/calls shape (last 5 days) =====`);
  const dates: string[] = [];
  for (let i = 1; i <= 5; i++) dates.push(trDate(new Date(Date.now() - i * 86400000)));
  for (const date of dates) {
    try {
      const calls = (await fetchCallsByDate(date)).calls;
      const withDeal = calls.filter((c: any) => c.deal_id).length;
      const withRecField = calls.filter((c: any) => c.recording_url).length;
      const keys = calls[0] ? Object.keys(calls[0]).join(",") : "(no calls)";
      console.log(`  ${date}: calls=${calls.length}  deal_id set=${withDeal}  recording_url set=${withRecField}`);
      if (date === dates[0]) console.log(`    sample call keys: ${keys}`);
    } catch (err: any) {
      console.log(`  ${date}: FETCH FAILED — ${err?.message}`);
    }
    await sleep(300);
  }

  // ===== BOUNDARY 3: manifest reachability for stored deal-urls =====
  console.log(`\n===== BOUNDARY 3: manifest fetch for stored deal-urls (sample of 5) =====`);
  const sample = evals.filter((e) => isDealUrl(e.recordingUrl)).slice(0, 5);
  if (!sample.length) console.log(`  (no stored deal-urls in last 14 days to test)`);
  for (const e of sample) {
    try {
      const res = await fetch(e.recordingUrl!, { headers: { "X-API-Key": KEY } });
      let downloadOk = false, body = "";
      if (res.ok) {
        const j: any = await res.json().catch(() => null);
        downloadOk = !!j?.recordings?.[0]?.download_url;
        body = j ? `recordings=${(j.recordings || []).length}` : "(non-json)";
      }
      console.log(`  ${e.recordingUrl}  -> HTTP ${res.status}  download_url=${downloadOk}  ${body}`);
    } catch (err: any) {
      console.log(`  ${e.recordingUrl}  -> FETCH THREW ${err?.message}`);
    }
    await sleep(300);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
