// Değerlendirme skorlarını, kayıtta duran JSON bloğundan YENİDEN HESAPLAR.
// Gemini'ye HİÇ GİTMEZ — blok zaten veritabanında.
//
// NEDEN: model çok terimli toplamda yanılıyor. 1-2 Eylül'ün 87 kaydında
// ölçüldü: 16'sında (%18) modelin yazdığı overallScore kendi
// passedCriteria/weakCriteria verisini tutmuyordu; sapma −10 ile +26 puan.
// Kartta da görünüyordu: sayaç "7 / 18 puan" derken büyük skor "%65" diyordu.
//
// Verdict'ler ve ağırlıklar güvenilir; güvenilmez olan aritmetik.
// Hesap app/lib/reportJson.ts içindeki deriveScoreFromBlock ile yapılır —
// yeni değerlendirmelerde de aynı fonksiyon çalışıyor.
//
// Kullanım:
//   npx tsx scripts/recompute-scores.ts                      # kuru çalışma
//   npx tsx scripts/recompute-scores.ts --from 2026-09-01 --to 2026-09-02
//   npx tsx scripts/recompute-scores.ts --apply
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { deriveScoreFromBlock, deriveSectionScoresFromBlock } from "../app/lib/reportJson";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

/** Türkiye günü — repo genelinde tarihler TR gününe göre yorumlanır. */
function trDay(v: string | undefined, flag: string): Date | undefined {
  if (!v) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) { console.error(`${flag} YYYY-MM-DD olmalı.`); process.exit(1); }
  return new Date(`${v}T00:00:00.000+03:00`);
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const from = trDay(arg(args, "--from"), "--from");
  const toDay = trDay(arg(args, "--to"), "--to");
  const to = toDay ? new Date(toDay.getTime() + 86400000) : undefined;

  const where: any = { NOT: { reportData: { equals: null } } };
  if (from || to) {
    where.callDate = {};
    if (from) where.callDate.gte = from;
    if (to) where.callDate.lt = to;
  }

  const rows = await prisma.evaluation.findMany({
    where,
    select: { id: true, score: true, reportData: true, sectionScores: true, customerName: true, callDate: true },
    orderBy: { callDate: "asc" },
  });

  console.log(`bloklu kayıt: ${rows.length}${apply ? "" : "  (KURU ÇALIŞMA — yazmak için --apply)"}\n`);

  const degisen: { id: string; ad: string; eski: number; yeni: number }[] = [];
  const secDegisen: { id: string; sec: any }[] = [];
  let hesaplanamayan = 0, ayni = 0;

  for (const r of rows) {
    // Bölüm skorları da kriter verisinden hesaplanır (aynı gerekçe).
    const sec = deriveSectionScoresFromBlock(r.reportData);
    if (sec && JSON.stringify(sec) !== JSON.stringify(r.sectionScores)) {
      secDegisen.push({ id: r.id, sec });
    }
    const yeni = deriveScoreFromBlock(r.reportData);
    if (yeni === null) { hesaplanamayan++; continue; }
    if (yeni === r.score) { ayni++; continue; }
    degisen.push({ id: r.id, ad: r.customerName, eski: r.score, yeni });
  }

  for (const d of degisen.sort((a, b) => Math.abs(b.yeni - b.eski) - Math.abs(a.yeni - a.eski))) {
    const fark = d.yeni - d.eski;
    console.log(`  %${String(d.eski).padStart(3)} → %${String(d.yeni).padStart(3)}  (${fark > 0 ? "+" : ""}${fark})  ${d.ad}`);
  }

  if (apply) {
    for (const d of degisen) {
      await prisma.evaluation.update({ where: { id: d.id }, data: { score: d.yeni } });
    }
    for (const s of secDegisen) {
      await prisma.evaluation.update({ where: { id: s.id }, data: { sectionScores: s.sec } });
    }
  }

  const ortEski = rows.length ? degisen.reduce((s, d) => s + d.eski, 0) : 0;
  const ortYeni = rows.length ? degisen.reduce((s, d) => s + d.yeni, 0) : 0;
  console.log(
    `\ndeğişen ${degisen.length} · aynı ${ayni} · hesaplanamayan ${hesaplanamayan}` +
    (degisen.length ? ` · değişenlerin ortalaması %${(ortEski/degisen.length).toFixed(1)} → %${(ortYeni/degisen.length).toFixed(1)}` : ""),
  );
  console.log(`bölüm skoru düzeltilecek: ${secDegisen.length}`);
  if (!apply) console.log("kuru çalışma: hiçbir kayıt güncellenmedi.");
  else console.log(`${degisen.length} skor + ${secDegisen.length} bölüm skoru güncellendi.`);
}

main().then(() => prisma.$disconnect()).catch((e) => { console.error(e); process.exit(1); });
