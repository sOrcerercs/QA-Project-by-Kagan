// scripts/backfill-agent-match.ts
// One-off: manuel-atamada (unassigned:true) sıkışmış değerlendirmeleri, mevcut
// eşleştiriciyle externalAgentName üzerinden yeniden eşleştirir. YALNIZCA kesin
// (exact) eşleşmeler otomatik uygulanır; partial/single eşleşmeler manuel inceleme
// için raporlanır, uygulanmaz.
//   npx tsx scripts/backfill-agent-match.ts          # dry-run (yazma yok)
//   npx tsx scripts/backfill-agent-match.ts --apply  # exact eşleşmeleri atar
//
// Standalone: .env.local/.env'i kendi yükler, kendi Prisma client'ını kurar.
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

async function main() {
  loadEnv();
  const APPLY = process.argv.includes("--apply");
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL missing (is .env.local present?).");

  const { PrismaClient } = await import("../app/generated/prisma");
  const { PrismaPg } = await import("@prisma/adapter-pg");
  const { matchAgentName } = await import("../app/lib/agentMatch");
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) } as any);

  const candidates = await prisma.user.findMany({
    where: { role: { in: ["AGENT", "TEAM_LEADER", "MANAGER"] } },
    select: { id: true, name: true },
  });

  const rows = await prisma.evaluation.findMany({
    where: { unassigned: true },
    select: { id: true, externalAgentName: true, source: true, customerName: true, callDate: true },
  });

  const toAssign: { id: string; raw: string | null; targetId: string; targetName: string; customer: string; date: string }[] = [];
  const fuzzy: { raw: string | null; targetName: string; tier: string; customer: string }[] = [];
  const noMatch: { raw: string | null; customer: string }[] = [];

  for (const r of rows) {
    const d = new Date(r.callDate).toISOString().slice(0, 10);
    const exact = matchAgentName(r.externalAgentName, candidates, { allowPartial: false, allowSingleWord: false });
    if (exact) {
      toAssign.push({ id: r.id, raw: r.externalAgentName, targetId: exact.candidate.id, targetName: exact.candidate.name, customer: r.customerName, date: d });
      continue;
    }
    const loose = matchAgentName(r.externalAgentName, candidates);
    if (loose) fuzzy.push({ raw: r.externalAgentName, targetName: loose.candidate.name, tier: loose.tier, customer: r.customerName });
    else noMatch.push({ raw: r.externalAgentName, customer: r.customerName });
  }

  console.log(`Manuel-atama toplam: ${rows.length}`);
  console.log(`\n== KESİN eşleşme (${toAssign.length}) — ${APPLY ? "UYGULANACAK" : "dry-run"} ==`);
  for (const a of toAssign) console.log(`  "${a.raw}"  →  ${a.targetName}  [${a.customer} · ${a.date}]`);
  console.log(`\n== GEVŞEK eşleşme (${fuzzy.length}) — UYGULANMAZ, manuel incele ==`);
  for (const f of fuzzy) console.log(`  "${f.raw}"  ?→  ${f.targetName} (${f.tier})  [${f.customer}]`);
  console.log(`\n== Eşleşme YOK (${noMatch.length}) ==`);
  for (const n of noMatch) console.log(`  "${n.raw ?? "(boş)"}"  [${n.customer}]`);

  if (APPLY && toAssign.length > 0) {
    for (const a of toAssign) {
      await prisma.evaluation.update({ where: { id: a.id }, data: { agentId: a.targetId, unassigned: false } });
    }
    console.log(`\n✅ ${toAssign.length} çağrı atandı (unassigned=false).`);
  } else if (!APPLY) {
    console.log(`\nDry-run. Uygulamak için: npx tsx scripts/backfill-agent-match.ts --apply`);
  }

  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
