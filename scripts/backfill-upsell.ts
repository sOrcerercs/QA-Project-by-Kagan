// Geçmiş SECOND_CALL değerlendirmelerinin "Upsell Durumu" satırını sınıflandırıp
// EvaluationUpsell tablosuna yazar.
//
// Yeniden çalıştırılabilir: yalnızca satırı OLMAYAN kayıtları işler, yarıda
// kesilirse kaldığı yerden devam eder. source="MANUAL" satırlara dokunmaz
// (zaten satırı olan hiçbir kayda dokunmaz).
//
// Kullanım:
//   npx tsx scripts/backfill-upsell.ts --dry-run
//   npx tsx scripts/backfill-upsell.ts --limit 100
//   npx tsx scripts/backfill-upsell.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { extractUpsellLine, type UpsellBatchItem } from "../app/lib/upsellClassify";
import { classifyWithFallback, CLASSIFIER_MODEL } from "../app/lib/upsellClassifier";

// DİKKAT: `import prisma from "../app/lib/prisma"` KULLANILMAZ. Import'lar
// hoist edildiği için o modülün gövdesi yukarıdaki config() çağrılarından
// ÖNCE çalışır; DATABASE_URL henüz okunmamış olur ve adapter localhost'a
// bağlanmaya çalışıp ECONNREFUSED verir. Bunun yerine client script içinde,
// config()'ten sonra kurulur. Bkz. scripts/okr-check.ts, scripts/seed-prompts.ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

const CHUNK = 50;

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const limitArg = args.indexOf("--limit");
  const limit = limitArg !== -1 ? Number(args[limitArg + 1]) : undefined;

  const pending = await prisma.evaluation.findMany({
    where: { callType: "SECOND_CALL", evaluationUpsell: { is: null } },
    select: { id: true, report: true },
    orderBy: { callDate: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  console.log(`Sınıflandırılacak kayıt: ${pending.length}`);
  if (pending.length === 0) return;

  if (dryRun) {
    const withLine = pending.filter((e) => extractUpsellLine(e.report) !== null).length;
    console.log(`  "Upsell Durumu" satırı olan : ${withLine}`);
    console.log(`  satırı olmayan (BILINMIYOR) : ${pending.length - withLine}`);
    console.log(`  tahmini Gemini isteği       : ~${Math.ceil(withLine / CHUNK)}`);
    console.log("--dry-run: hiçbir şey yazılmadı.");
    return;
  }

  let classified = 0, unknown = 0, failed = 0;

  for (let offset = 0; offset < pending.length; offset += CHUNK) {
    const slice = pending.slice(offset, offset + CHUNK);
    const items: UpsellBatchItem[] = [];
    const indexToId = new Map<number, string>();

    for (const ev of slice) {
      const line = extractUpsellLine(ev.report);
      if (!line) {
        await prisma.evaluationUpsell.create({
          data: { evaluationId: ev.id, stemCell: "BILINMIYOR", premium: "BILINMIYOR", model: null },
        });
        unknown++;
        continue;
      }
      const i = items.length + 1;
      items.push({ i, line });
      indexToId.set(i, ev.id);
    }

    const verdicts = await classifyWithFallback(items);
    for (const [i, v] of verdicts) {
      const evaluationId = indexToId.get(i);
      if (!evaluationId) continue;
      await prisma.evaluationUpsell.create({
        data: { evaluationId, stemCell: v.stemCell, premium: v.premium, model: CLASSIFIER_MODEL },
      });
      classified++;
    }
    failed += items.length - verdicts.size;

    console.log(`  ${Math.min(offset + CHUNK, pending.length)}/${pending.length} — sınıflandırılan: ${classified}, bilinmiyor: ${unknown}, başarısız: ${failed}`);
  }

  console.log(`\nBitti. Sınıflandırılan: ${classified}, bilinmiyor: ${unknown}, başarısız: ${failed}`);
  if (failed > 0) console.log("Başarısız kayıtlar bekleyen havuzunda kaldı; script'i tekrar çalıştırabilirsin.");
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
