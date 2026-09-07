// Mevcut EvaluationUpsell satırlarını GÜNCEL sınıflandırıcı promptuyla yeniden
// değerlendirir ve değişenleri günceller.
//
// backfill-*.ts script'lerinden farkı: onlar yalnızca BOŞ alanları dolduruyor,
// bu ise stemCell/premium kararlarını da yeniden yazabiliyor. Prompt kuralı
// değiştiğinde (ör. "paket içeriğiyle tarif edilmişse de SUNULDU") kullanılır.
//
// Kapsam: yalnızca SUNULMADI içeren satırlar. SUNULDU/NA olanlarda kazanılacak
// bir şey yok, dokunup rastgele oynatmanın anlamı yok.
//
// VARSAYILAN: yalnızca KAZANÇ yazılır — bir alan SUNULMADI iken SUNULDU'ya
// çıkıyorsa uygulanır, diğer her değişiklik yok sayılır. Sebep: sınıflandırıcı
// tam determinist değil; tüm seti yeniden değerlendirmek, düzeltmek istediğimiz
// kayıtlar uğruna alakasız kararları (özellikle doğru NA'ları) oynatıyor.
// 2026-08-16 ölçümü: 618 kayıtta 14 değişiklik, yalnızca 7'si kastedilen
// düzeltme, 2'si açık gerileme (doğru NA → SUNULMADI).
// --all-changes bu korumayı kaldırır; prod verisinde kullanmadan önce iki kez düşün.
//
// --dry-run HİÇBİR ŞEY YAZMAZ, yalnızca değişecek kararları listeler. Prod
// verisini değiştiren bir script olduğu için önce mutlaka dry-run çalıştır.
//
// Kullanım:
//   npx tsx scripts/reclassify-upsell.ts --dry-run
//   npx tsx scripts/reclassify-upsell.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { extractUpsellLine, type UpsellBatchItem } from "../app/lib/upsellClassify";
import { classifyWithFallback, CLASSIFIER_MODEL } from "../app/lib/upsellClassifier";

// DİKKAT: `import prisma from "../app/lib/prisma"` KULLANILMAZ — bkz.
// scripts/backfill-upsell.ts başındaki not.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const onlyGains = !args.includes("--all-changes");
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
    where: { OR: [{ stemCell: "SUNULMADI" }, { premium: "SUNULMADI" }] },
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

  let yazilan = 0, ayni = 0, atlanan = 0;
  for (const [i, v] of verdicts) {
    const row = indexToRow.get(i);
    if (!row) continue;
    if (v.stemCell === row.stemCell && v.premium === row.premium) { ayni++; continue; }

    // Kazanç: bir alan SUNULMADI iken SUNULDU'ya çıkmış. Bunun dışındaki her
    // değişiklik (NA'ya kayma, SUNULDU/NA'dan SUNULMADI'ya düşme) korumalı modda
    // yok sayılır — model gürültüsünün doğru kararları bozmasını engeller.
    const kazanc =
      (row.stemCell === "SUNULMADI" && v.stemCell === "SUNULDU") ||
      (row.premium === "SUNULMADI" && v.premium === "SUNULDU");
    const gerileme =
      (row.stemCell !== "SUNULMADI" && v.stemCell === "SUNULMADI") ||
      (row.premium !== "SUNULMADI" && v.premium === "SUNULMADI");

    if (onlyGains && (!kazanc || gerileme)) {
      atlanan++;
      console.log(`  ATLANDI ${row.stemCell}/${row.premium} → ${v.stemCell}/${v.premium}`);
      console.log(`     ${items[i - 1].line.slice(0, 150)}`);
      continue;
    }

    yazilan++;
    console.log(`  ${row.stemCell}/${row.premium} → ${v.stemCell}/${v.premium}`);
    console.log(`     ${items[i - 1].line.slice(0, 150)}`);
    if (!dryRun) {
      await prisma.evaluationUpsell.update({
        where: { id: row.id },
        data: {
          stemCell: v.stemCell,
          premium: v.premium,
          // customerChosePremium / budgetConstraint bilerek EZİLMİYOR: onlar
          // kendi backfill'leriyle gözden geçirilip yazıldı, bu script yalnızca
          // sunuldu/sunulmadı kararını düzeltmek için var.
          model: CLASSIFIER_MODEL,
        },
      });
    }
  }

  console.log(`\nyazılan ${yazilan} · korumayla atlanan ${atlanan} · aynı kalan ${ayni} · rapor satırı yok ${noLine} · sınıflandırılamayan ${items.length - verdicts.size}`);
  if (onlyGains) console.log("(yalnızca SUNULMADI → SUNULDU geçişleri yazılır; --all-changes ile kaldırılır)");
  if (dryRun) console.log("dry-run: hiçbir kayıt güncellenmedi.");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
