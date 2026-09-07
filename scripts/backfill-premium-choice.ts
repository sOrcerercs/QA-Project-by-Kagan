// Mevcut EvaluationUpsell satırlarına customerChosePremium alanını doldurur.
//
// Yalnızca kuralın tetiklenebileceği satırlara dokunur:
//   stemCell = SUNULMADI  AND  premium = SUNULDU  AND  customerChosePremium IS NULL
// Diğer satırlarda alan hiçbir sonucu değiştirmediği için boş bırakılır —
// 1500+ kaydı yeniden sınıflandırmaya gerek yok (bkz. okr.ts effectiveStemCell).
//
// Yeniden çalıştırılabilir: dolu satırlara dokunmaz, yarıda kesilirse kaldığı
// yerden devam eder.
//
// Kullanım:
//   npx tsx scripts/backfill-premium-choice.ts --dry-run
//   npx tsx scripts/backfill-premium-choice.ts
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
  const dryRun = process.argv.includes("--dry-run");

  const rows = await prisma.evaluationUpsell.findMany({
    where: { stemCell: "SUNULMADI", premium: "SUNULDU", customerChosePremium: null },
    select: { id: true, evaluation: { select: { report: true } } },
  });

  console.log(`Aday satır: ${rows.length}${dryRun ? " (dry-run)" : ""}`);
  if (rows.length === 0) return;

  const items: UpsellBatchItem[] = [];
  const indexToRowId = new Map<number, string>();
  let noLine = 0;

  for (const r of rows) {
    const line = extractUpsellLine(r.evaluation.report);
    if (!line) { noLine++; continue; }
    const i = items.length + 1;
    items.push({ i, line });
    indexToRowId.set(i, r.id);
  }

  const verdicts = await classifyWithFallback(items);

  let evet = 0, hayir = 0, atlanan = 0;
  for (const [i, verdict] of verdicts) {
    const id = indexToRowId.get(i);
    if (!id) continue;
    // Sınıflandırıcı alanı atlarsa satır NULL kalır: kural tetiklenmez,
    // metrik bugünkü kadar sıkı kalır.
    if (!verdict.customerChosePremium) { atlanan++; continue; }
    if (verdict.customerChosePremium === "EVET") evet++; else hayir++;
    // Dry-run'da kararı gerekçesiyle göster: EVET kararları Stem Cell paydasını
    // küçülttüğü için gözle doğrulanabilmeli.
    if (dryRun) {
      console.log(`  [${verdict.customerChosePremium}] ${items[i - 1].line.slice(0, 160)}`);
    }
    if (!dryRun) {
      await prisma.evaluationUpsell.update({
        where: { id },
        data: { customerChosePremium: verdict.customerChosePremium },
      });
    }
  }

  console.log(`EVET: ${evet} · HAYIR: ${hayir} · alan gelmedi: ${atlanan} · rapor satırı yok: ${noLine} · sınıflandırılamayan: ${items.length - verdicts.size}`);
  if (dryRun) console.log("dry-run: hiçbir kayıt güncellenmedi.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
