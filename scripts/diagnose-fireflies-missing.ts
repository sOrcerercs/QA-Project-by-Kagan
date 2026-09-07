// READ-ONLY: diagnose why a specific Fireflies transcript wasn't imported.
//   npx tsx scripts/diagnose-fireflies-missing.ts <transcriptId>
import * as fs from "fs"; import * as path from "path";
function loadEnv() {
  for (const f of [".env.local", ".env"]) {
    const p = path.resolve(process.cwd(), f); if (!fs.existsSync(p)) continue;
    for (const raw of fs.readFileSync(p, "utf8").split("\n")) {
      const m = raw.match(/^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/); if (!m) continue; let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (process.env[m[1]] === undefined) process.env[m[1]] = v;
    }
  }
}
const ENDPOINT = "https://api.fireflies.ai/graphql";
const SINGLE = `query T($id: String!) {
  transcript(id: $id) {
    id title date duration host_email participants
    sentences { speaker_name text start_time end_time }
  }
}`;

async function gql(query: string, variables: any) {
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${process.env.FIREFLIES_API_KEY}` },
    body: JSON.stringify({ query, variables }),
  });
  const json = await res.json();
  return { ok: res.ok, status: res.status, json };
}

async function main() {
  loadEnv();
  const id = process.argv[2];
  if (!id) throw new Error("usage: tsx scripts/diagnose-fireflies-missing.ts <transcriptId>");
  if (!process.env.FIREFLIES_API_KEY) throw new Error("FIREFLIES_API_KEY missing.");

  const { fetchTranscriptsByDate, resolveDurationMinutes, filterAnalyzableTranscripts, buildTranscriptText, extractSpeakerNames } =
    await import("../app/lib/fireflies");
  const { PrismaClient } = await import("../app/generated/prisma");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) } as any);

  // ===== 1) Is it already in the DB? =====
  const externalCallId = `ff_${id}`;
  const existing = await prisma.evaluation.findUnique({
    where: { externalCallId },
    select: { id: true, customerName: true, source: true, unassigned: true, callDate: true },
  });
  console.log(`\n===== DB =====`);
  console.log(existing ? `FOUND in DB: ${JSON.stringify(existing)}` : `NOT in DB (externalCallId=${externalCallId})`);

  // ===== 2) Fetch the transcript directly by id =====
  console.log(`\n===== Fireflies single-transcript fetch =====`);
  const r = await gql(SINGLE, { id });
  if (!r.ok || r.json.errors || !r.json.data?.transcript) {
    console.log(`  status=${r.status}  errors=${JSON.stringify(r.json.errors)?.slice(0,300)}  data=${JSON.stringify(r.json.data)?.slice(0,200)}`);
    await prisma.$disconnect();
    return;
  }
  const t = r.json.data.transcript;
  const dur = resolveDurationMinutes(t);
  const text = buildTranscriptText(t.sentences || []);
  const speakers = extractSpeakerNames(t.sentences || []);
  const dt = new Date(t.date);
  // TR date (UTC+3)
  const trDate = new Date(t.date + 3 * 3600000).toISOString().slice(0, 10);
  console.log(`  title=${t.title}`);
  console.log(`  date(ms)=${t.date}  UTC=${dt.toISOString()}  -> TR day=${trDate}`);
  console.log(`  duration(field)=${t.duration}  resolvedMin=${dur}`);
  console.log(`  sentences=${(t.sentences||[]).length}  textLen=${text.trim().length}`);
  console.log(`  host_email=${t.host_email}  participants=${JSON.stringify(t.participants)}`);
  console.log(`  speakers=${JSON.stringify(speakers)}`);

  // Would it pass the analyzable filter?
  const passes = filterAnalyzableTranscripts([t as any]).length === 1;
  console.log(`  PASSES analyzable filter (dur>=2 & sentences>0 & textLen>50): ${passes}`);
  if (!passes) {
    const reasons = [];
    if (!(dur == null || dur >= 2)) reasons.push(`duration ${dur}min < 2`);
    if (!((t.sentences||[]).length > 0)) reasons.push("no sentences");
    if (!(text.trim().length > 50)) reasons.push(`textLen ${text.trim().length} <= 50`);
    console.log(`    -> filtered out because: ${reasons.join(", ")}`);
  }

  // ===== 3) Does the date-window fetch return it? (tests date window + ~50 limit) =====
  console.log(`\n===== Date-window fetch for TR day ${trDate} (what the sync actually sees) =====`);
  try {
    const list = await fetchTranscriptsByDate(trDate);
    const found = list.find((x: any) => x.id === id);
    console.log(`  fetchTranscriptsByDate('${trDate}') returned ${list.length} transcripts`);
    console.log(`  target transcript present in that list: ${found ? "YES" : "NO"}`);
    if (list.length) {
      const dates = list.map((x: any) => x.date).sort((a: number, b: number) => a - b);
      console.log(`  list date range: ${new Date(dates[0]).toISOString()} .. ${new Date(dates[dates.length-1]).toISOString()}`);
    }
  } catch (e: any) {
    console.log(`  fetchTranscriptsByDate failed: ${e.message}`);
  }

  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
