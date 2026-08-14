// OKR verisinin durumunu yazdıran salt-okunur kontrol script'i.
// Hiçbir yazma işlemi yapmaz.
//
//   npx tsx scripts/okr-check.ts
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

// DİKKAT: `import prisma from "../app/lib/prisma"` KULLANILMAZ. Import'lar
// hoist edildiği için o modülün gövdesi yukarıdaki config() çağrılarından
// ÖNCE çalışır; DATABASE_URL henüz okunmamış olur ve adapter localhost'a
// bağlanmaya çalışıp ECONNREFUSED verir. Bunun yerine client script içinde,
// config()'ten sonra kurulur. Bkz. scripts/seed-prompts.ts
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const [upsellCount, sellerCount, secondCall, pending] = await Promise.all([
    prisma.evaluationUpsell.count(),
    prisma.okrBottomSeller.count(),
    prisma.evaluation.count({ where: { callType: "SECOND_CALL" } }),
    prisma.evaluation.count({
      where: { callType: "SECOND_CALL", evaluationUpsell: { is: null } },
    }),
  ]);

  console.log("EvaluationUpsell satırı :", upsellCount);
  console.log("OkrBottomSeller satırı  :", sellerCount);
  console.log("SECOND_CALL toplam      :", secondCall);
  console.log("sınıflandırma bekleyen  :", pending);

  if (upsellCount > 0) {
    const [byStem, byPrem] = await Promise.all([
      prisma.evaluationUpsell.groupBy({ by: ["stemCell"], _count: { _all: true } }),
      prisma.evaluationUpsell.groupBy({ by: ["premium"], _count: { _all: true } }),
    ]);
    console.log("\nstemCell dağılımı:", JSON.stringify(byStem));
    console.log("premium  dağılımı:", JSON.stringify(byPrem));

    const sample = await prisma.evaluationUpsell.findMany({
      take: 5,
      select: { stemCell: true, premium: true, source: true, model: true },
    });
    console.log("\nörnek satırlar:");
    console.table(sample);
  }
}

main()
  .catch((e) => { console.error(e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
