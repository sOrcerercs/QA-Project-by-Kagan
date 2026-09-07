// Geçmiş EvaluationUpsell satırlarına sessizlik korumasını uygular:
// rapor satırında bahsi hiç geçmeyen bir kalem SUNULMADI ise BILINMIYOR yapılır.
//
// MODEL ÇAĞRISI YOK. Karar tamamen deterministik (satırda kelime geçiyor mu),
// bu yüzden yeniden sınıflandırmanın gürültüsü olmadan çalışır ve aynı girdide
// hep aynı sonucu verir. Bkz. app/lib/upsellClassify.ts applySilenceGuard.
//
// Kullanım:
//   npx tsx scripts/backfill-silence-guard.ts --dry-run
//   npx tsx scripts/backfill-silence-guard.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { extractUpsellLine, applySilenceGuard } from "../app/lib/upsellClassify";

// DİKKAT: `import prisma from "../app/lib/prisma"` KULLANILMAZ — bkz.
// scripts/backfill-upsell.ts başındaki not.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const dryRun = process.argv.includes("--dry-run");

  const rows = await prisma.evaluationUpsell.findMany({
    where: { OR: [{ stemCell: "SUNULMADI" }, { premium: "SUNULMADI" }] },
    select: { id: true, stemCell: true, premium: true, evaluation: { select: { report: true } } },
  });
  console.log(`Aday satır: ${rows.length}${dryRun ? " (dry-run)" : ""}`);

  let stemFix = 0, premFix = 0, dokunulmayan = 0, satirYok = 0;
  for (const r of rows) {
    const line = extractUpsellLine(r.evaluation.report);
    // Satır hiç yoksa karar veremeyiz; bu kayıtlar zaten sınıflandırma
    // aşamasında BILINMIYOR yazılıyor, buraya düşerse dokunma.
    if (!line) { satirYok++; continue; }

    const out = applySilenceGuard(
      { i: 0, stemCell: r.stemCell as any, premium: r.premium as any },
      line
    );
    if (out.stemCell === r.stemCell && out.premium === r.premium) { dokunulmayan++; continue; }
    if (out.stemCell !== r.stemCell) stemFix++;
    if (out.premium !== r.premium) premFix++;

    if (!dryRun) {
      await prisma.evaluationUpsell.update({
        where: { id: r.id },
        data: { stemCell: out.stemCell, premium: out.premium },
      });
    }
  }

  console.log(`Stem Cell → BILINMIYOR: ${stemFix} · Premium → BILINMIYOR: ${premFix} · değişmeyen: ${dokunulmayan} · rapor satırı yok: ${satirYok}`);
  if (dryRun) console.log("dry-run: hiçbir kayıt güncellenmedi.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
