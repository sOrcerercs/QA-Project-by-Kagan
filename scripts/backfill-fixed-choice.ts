// Mevcut EvaluationUpsell satırlarına customerFixedChoice alanını doldurur.
//
// Kural: müşteri belirli bir paketi net olarak tercih ettiğini beyan ettiyse
// üstünü satmak için ısrarcı olunmuyor → o çağrıda hem Stem Cell hem Premium
// cezası kalkar (bkz. okr.ts upsellExemption).
//
// Yalnızca kuralın sonucu değiştirebileceği satırlara dokunur:
//   (stemCell = SUNULMADI VEYA premium = SUNULMADI)  AND  customerFixedChoice IS NULL
// Kural sadece CEZA kaldırıyor; ikisi de SUNULDU/NA olan satırlarda hiçbir şeyi
// değiştirmediği için onlar atlanır.
//
// DETERMİNİSTİK DEĞİL: karar modele ait. Kaba kelime taraması bu ayrımı
// yapamıyor, çünkü raporların çoğu "sadece temel paket detayları verildi" diyor
// ve bu DANIŞMANIN kapsamı, müşterinin tercihi değil. Prompt bu ayrımı anlam
// düzeyinde yapıyor (bkz. upsellClassifier.ts customerFixedChoice bloğu).
//
// Yeniden çalıştırılabilir: dolu satırlara dokunmaz, yarıda kesilirse kaldığı
// yerden devam eder.
//
// Kullanım:
//   npx tsx scripts/backfill-fixed-choice.ts --dry-run
//   npx tsx scripts/backfill-fixed-choice.ts --dry-run --limit 50
//   npx tsx scripts/backfill-fixed-choice.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { extractUpsellLine, type UpsellBatchItem } from "../app/lib/upsellClassify";
import { classifyWithFallback } from "../app/lib/upsellClassifier";

// DİKKAT: `import prisma from "../app/lib/prisma"` KULLANILMAZ — bkz.
// scripts/backfill-upsell.ts başındaki not.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.indexOf("--limit");
  let limit: number | undefined;
  if (limitArg !== -1) {
    limit = Number(args[limitArg + 1]);
    if (!Number.isFinite(limit) || !Number.isInteger(limit) || limit <= 0) {
      console.error("--limit pozitif bir tam sayı olmalı (ör. --limit 50).");
      process.exit(1);
    }
  }

  const rows = await prisma.evaluationUpsell.findMany({
    where: {
      customerFixedChoice: null,
      OR: [{ stemCell: "SUNULMADI" }, { premium: "SUNULMADI" }],
    },
    select: { id: true, stemCell: true, premium: true, evaluation: { select: { report: true } } },
    orderBy: { classifiedAt: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`Aday satır: ${rows.length}${dryRun ? " (dry-run)" : ""}`);
  if (rows.length === 0) return;

  const items: UpsellBatchItem[] = [];
  const indexToRow = new Map<number, (typeof rows)[number]>();
  let noLine = 0;

  for (const r of rows) {
    const line = extractUpsellLine(r.evaluation.report);
    if (!line) { noLine++; continue; }
    const i = items.length + 1;
    items.push({ i, line });
    indexToRow.set(i, r);
  }

  const verdicts = await classifyWithFallback(items);

  let evet = 0, hayir = 0, atlanan = 0;
  for (const [i, verdict] of verdicts) {
    const row = indexToRow.get(i);
    if (!row) continue;
    // Alan gelmezse satır NULL kalır: kural tetiklenmez, metrik olduğu kadar
    // sıkı kalır — eksik veri asla muafiyete dönüşmez.
    if (!verdict.customerFixedChoice) { atlanan++; continue; }
    if (verdict.customerFixedChoice === "EVET") evet++; else hayir++;
    if (dryRun) {
      if (verdict.customerFixedChoice === "EVET") {
        console.log(`  [EVET] ${items[i - 1].line.slice(0, 150)}`);
      }
      continue;
    }
    await prisma.evaluationUpsell.update({
      where: { id: row.id },
      data: { customerFixedChoice: verdict.customerFixedChoice },
    });
  }

  console.log(`EVET: ${evet} · HAYIR: ${hayir} · alan gelmedi: ${atlanan} · rapor satırı yok: ${noLine} · sınıflandırılamayan: ${items.length - verdicts.size}`);
  if (dryRun) console.log("dry-run: hiçbir kayıt güncellenmedi. (Yukarıda yalnızca EVET kararları listelendi.)");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
