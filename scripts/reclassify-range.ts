// Bir tarih aralığındaki değerlendirmeleri, AKTİF promptla ve DÜŞÜNME AÇIK
// olarak yeniden üretir. Sayfadaki "yeniden sınıflandır" düğmesinin toplu hâli.
//
// NEDEN VAR: düşünme (thinkingBudget) açıkken analiz ~50 sn sürüyor. Vercel
// Hobby'de istek tavanı 60 sn olduğu için toplu senkron ve cron yollarında
// düşünme KAPALI bırakıldı (bkz. app/lib/gemini.ts SCORING_THINKING_BUDGET).
// Yani otomatik gelen kayıtlar düşük kalitede kalıyor. Bu betik senin
// makinende çalıştığı için o tavana tabi değil — 40 aramayı 33 dakikada
// düşünmeli kaliteye çıkarır.
//
// SİLMEZ, YENİDEN ÇEKMEZ. Mevcut Evaluation satırını yerinde günceller:
// id korunur, dolayısıyla koçluk notları, geri bildirimler, itirazlar,
// QA rapor eşleşmeleri ve bildirimler yerinde kalır. Transkript zaten
// veritabanında olduğu için Kriko/Fireflies'a hiç gidilmez.
//
// ÇAĞRI TİPİNİ DEĞİŞTİRMEZ. Kaydın mevcut callType'ı neyse o tipin aktif
// promptu kullanılır. Bu bir yeniden PUANLAMA işi, yeniden sınıflandırma değil;
// tipi düzeltmek istiyorsan sayfadaki düğmeyi kullan.
//
// VARSAYILAN KURU ÇALIŞMA. Bu betik raporun TAMAMINI yeniden yazıyor; prod
// verisinde yazma varsayılan olmamalı. Yazmak için --apply gerekir.
//
// HARD FAIL KİLİDİ. D1 (medikal sınır) skoru doğrudan 0'a düşürüyor ve
// ölçtüğümüz kadarıyla koşudan koşuya değişebiliyor: aynı kayıtta 4 koşunun
// 2'sinde tetiklendi, diğer her şey (bölüm skorları, kırılan maddeler, kapsam)
// birebir aynıyken. Örnek yanlış pozitif: danışman "genelde 65 yaş üstü kabul
// etmiyoruz AMA yine de bilgileri medikal ekiple paylaşacağım" diyor — eleme
// yapmıyor, aramayı bitirmiyor, yani promptun kendi NOT-D1 kuralına giriyor.
// Bu yüzden puanı olan bir kaydı sıfıra düşüren sonuç VARSAYILAN OLARAK
// YAZILMAZ; listelenir, sen bakarsın. Bilerek yazdırmak için --allow-hardfail.
//
// Kullanım:
// TARİHLER TÜRKİYE GÜNÜDÜR. --from 2026-09-01, TR 1 Eylül 00:00'dan
// TR 2 Eylül 00:00'a kadar olan aramaları kapsar.
//
//   npx tsx scripts/reclassify-range.ts --from 2026-09-01
//   npx tsx scripts/reclassify-range.ts --from 2026-09-01 --limit 3
//   npx tsx scripts/reclassify-range.ts --from 2026-09-01 --limit 3 --apply
//   npx tsx scripts/reclassify-range.ts --from 2026-09-01 --to 2026-09-02 --apply
//   npx tsx scripts/reclassify-range.ts --from 2026-09-01 --apply --resume
//   npx tsx scripts/reclassify-range.ts --id cmtk3z021000104l6q56m2hjs --apply
//   npx tsx scripts/reclassify-range.ts --from 2026-09-01 --limit 5 --dump /tmp/rapor
//   npx tsx scripts/reclassify-range.ts --from 2026-09-01 --apply --allow-hardfail
//
// --dump <klasör>: üretilen raporu ve JSON bloğunu dosyaya yazar. Kuru
// çalışmada skorun neden değiştiğini görmenin tek yolu bu — büyük bir skor
// sıçraması düzeltme mi yoksa gerileme mi, rapora bakmadan anlaşılmaz.
import { config } from "dotenv";
config({ path: ".env.local" });
config({ path: ".env" });

import { PrismaClient } from "../app/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { callGemini, SCORING_THINKING_BUDGET } from "../app/lib/gemini";
import { extractReportJson, reportJsonFields } from "../app/lib/reportJson";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

// DİKKAT: `import prisma from "../app/lib/prisma"` KULLANILMAZ — bkz.
// scripts/backfill-upsell.ts başındaki not.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
const prisma = new PrismaClient({ adapter } as any);

function arg(args: string[], name: string): string | undefined {
  const i = args.indexOf(name);
  return i === -1 ? undefined : args[i + 1];
}

/**
 * "2026-09-01" → o Türkiye gününün başlangıcı (00:00 TR = 21:00 UTC bir önceki gün).
 *
 * TÜRKİYE GÜNÜ, UTC değil. Ekip "1 Eylül'ün çağrıları" derken Türkiye takvimini
 * kastediyor ve repo'nun geri kalanı da öyle çalışıyor (bkz. kriko.ts
 * yesterdayInTR). UTC günü kullanılsaydı pencere TR 03:00–03:00'a kayardı:
 * 1 Eylül'ün gece yarısındaki aramalar dışarıda kalır, 2 Eylül'ün ilk
 * saatleri içeri girerdi. Ölçüldü — 40 kaydın 5'i yanlış güne aitti.
 *
 * Türkiye 2016'dan beri sabit UTC+3, yaz saati uygulaması yok.
 */
function parseDay(value: string, flag: string): Date {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    console.error(`${flag} YYYY-MM-DD biçiminde olmalı (ör. 2026-09-01).`);
    process.exit(1);
  }
  const d = new Date(`${value}T00:00:00.000+03:00`);
  if (Number.isNaN(d.getTime())) {
    console.error(`${flag} geçersiz bir tarih: ${value}`);
    process.exit(1);
  }
  return d;
}

function hhmmss(ms: number): string {
  const s = Math.round(ms / 1000);
  return s < 60 ? `${s} sn` : `${Math.floor(s / 60)} dk ${String(s % 60).padStart(2, "0")} sn`;
}

async function main() {
  const args = process.argv.slice(2);
  const apply = args.includes("--apply");
  const resume = args.includes("--resume");
  const allowHardFail = args.includes("--allow-hardfail");
  const singleId = arg(args, "--id");
  const fromRaw = arg(args, "--from");
  const toRaw = arg(args, "--to");

  const dumpDir = arg(args, "--dump");
  const limitRaw = arg(args, "--limit");
  let limit: number | undefined;
  if (limitRaw !== undefined) {
    limit = Number(limitRaw);
    if (!Number.isInteger(limit) || limit <= 0) {
      console.error("--limit pozitif bir tam sayı olmalı (ör. --limit 3).");
      process.exit(1);
    }
  }

  if (!singleId && !fromRaw) {
    console.error("--from YYYY-MM-DD veya --id <evaluationId> ver.");
    process.exit(1);
  }

  let where: any;
  if (singleId) {
    where = { id: singleId };
  } else {
    const from = parseDay(fromRaw!, "--from");
    // --to dahil: verilen günün sonuna kadar.
    const toDay = toRaw ? parseDay(toRaw, "--to") : from;
    if (toDay < from) {
      console.error("--to, --from'dan önce olamaz.");
      process.exit(1);
    }
    const toExclusive = new Date(toDay.getTime() + 24 * 60 * 60 * 1000);
    where = { callDate: { gte: from, lt: toExclusive } };
  }

  // --resume: zaten yeni blokla üretilmiş kayıtları atla. Yarıda kesilen bir
  // koşu bu bayrakla kaldığı yerden devam eder.
  if (resume) where = { ...where, reportData: { equals: null } };

  const evaluations = await prisma.evaluation.findMany({
    where,
    select: {
      id: true, customerName: true, callDuration: true, transcript: true,
      callType: true, score: true, callDate: true,
      agent: { select: { name: true, team: { select: { name: true } } } },
    },
    orderBy: { callDate: "asc" },
    ...(limit ? { take: limit } : {}),
  });

  console.log(
    `Aday değerlendirme: ${evaluations.length}` +
    (apply ? "" : "  (KURU ÇALIŞMA — hiçbir şey yazılmayacak, yazmak için --apply)") +
    (resume ? "  [--resume: reportData'sı olanlar atlandı]" : ""),
  );
  if (evaluations.length === 0) return;
  if (apply) {
    console.log(`Tahmini süre: ~${hhmmss(evaluations.length * 50_000)} (düşünme açık, arama başına ~50 sn)\n`);
  } else {
    console.log("");
  }

  // Aktif promptlar bir kez okunur; koşu sırasında değişmesini beklemiyoruz.
  const promptCache = new Map<string, { id: string; content: string; version: string }>();
  async function activePrompt(callType: string) {
    const cached = promptCache.get(callType);
    if (cached) return cached;
    const p = await prisma.prompt.findFirst({
      where: { callType: callType as any, isActive: true },
      select: { id: true, content: true, version: true },
    });
    if (!p) return null;
    promptCache.set(callType, p);
    return p;
  }

  let updated = 0, unchangedScore = 0, failed = 0, noPrompt = 0;
  const hardFailSkipped: string[] = [];
  const started = Date.now();

  for (let i = 0; i < evaluations.length; i++) {
    const ev = evaluations[i];
    const tag = `[${i + 1}/${evaluations.length}] ${ev.id}`;
    const who = `${ev.customerName} · ${ev.agent?.name ?? "—"}`;

    if (!ev.transcript || ev.transcript.trim().length < 50) {
      console.log(`${tag} ATLANDI — transkript yok/çok kısa  ${who}`);
      failed++;
      continue;
    }

    const prompt = await activePrompt(ev.callType);
    if (!prompt) {
      console.log(`${tag} ATLANDI — ${ev.callType} için aktif prompt yok  ${who}`);
      noPrompt++;
      continue;
    }

    // /api/evaluations/[id]/re-classify route'undaki gövdenin aynısı.
    const fullPrompt = `${prompt.content}

=== DEĞERLENDİRİLECEK GÖRÜŞME BİLGİLERİ ===
Temsilci Adı: ${ev.agent?.name ?? "Belirtilmedi"}
Takım: ${ev.agent?.team?.name ?? "Belirtilmedi"}
Müşteri Adı: ${ev.customerName}
Görüşme Süresi: ${ev.callDuration}
Değerlendirme Tarihi: ${ev.callDate.toLocaleString("tr-TR", { month: "long", year: "numeric" })}

=== TRANSKRİPT ===
${ev.transcript}

Yukarıdaki transkripti kurallara göre değerlendir ve ZORUNLU ÇIKTI FORMATINDA Türkçe rapor üret.`;

    const t0 = Date.now();
    try {
      const reportText = await callGemini("Sen bir satış koçusun.", fullPrompt, {
        maxTokens: 65536,
        temperature: 0,
        thinkingBudget: SCORING_THINKING_BUDGET,
      });

      const extracted = extractReportJson(reportText);
      const { cleanReport, scoreRaw } = extracted;

      // Skor okunamadıysa mevcut skoru koru — 0 yazma. Route ile aynı koruma.
      const score = scoreRaw !== null && scoreRaw >= 0 && scoreRaw <= 100 ? scoreRaw : ev.score;
      if (scoreRaw === null) unchangedScore++;

      if (dumpDir) {
        mkdirSync(dumpDir, { recursive: true });
        writeFileSync(join(dumpDir, `${ev.id}.md`), cleanReport, "utf-8");
        writeFileSync(
          join(dumpDir, `${ev.id}.json`),
          JSON.stringify(extracted.reportData ?? {}, null, 2),
          "utf-8",
        );
      }

      const took = hhmmss(Date.now() - t0);
      const delta = score === ev.score ? `%${ev.score}` : `%${ev.score} → %${score}`;
      const blok = extracted.reportData ? "blok✓" : "blok✗";
      console.log(`${tag} ${delta}  ${blok}  ${took}  ${who}`);

      // Puanı olan bir kaydı hard fail yüzünden sıfıra düşürmek, yanlış
      // pozitifte geri dönüşü zor bir veri kaybı. Bilinçli onay istiyoruz.
      const zeroesOutByHardFail =
        (extracted.reportData as { hardFail?: unknown } | null)?.hardFail === true &&
        score === 0 && ev.score > 0;
      if (zeroesOutByHardFail && !allowHardFail) {
        hardFailSkipped.push(`${ev.id}  %${ev.score} → %0  ${who}`);
        console.log(`${tag} YAZILMADI — hard fail kaydı sıfıra düşürüyor (--allow-hardfail ile yazılır)`);
        continue;
      }

      if (!apply) continue;

      await prisma.evaluation.update({
        where: { id: ev.id },
        data: { report: cleanReport, score, ...reportJsonFields(extracted) },
      });
      updated++;
    } catch (e: any) {
      failed++;
      console.log(`${tag} HATA — ${String(e?.message ?? e).slice(0, 160)}  ${who}`);
    }
  }

  console.log(
    `\ntoplam ${evaluations.length} · güncellenen ${updated} · hata ${failed} · prompt yok ${noPrompt}` +
    (unchangedScore ? ` · skor satırı okunamayan ${unchangedScore} (eski skor korundu)` : "") +
    ` · süre ${hhmmss(Date.now() - started)}`,
  );
  if (hardFailSkipped.length) {
    console.log(`\nhard fail nedeniyle yazılmayan ${hardFailSkipped.length} kayıt:`);
    for (const line of hardFailSkipped) console.log("  " + line);
    console.log("  bunları --dump ile inceleyip haklıysa --allow-hardfail ile yaz.");
  }
  if (!apply) console.log("kuru çalışma: hiçbir kayıt güncellenmedi. Yazmak için --apply ekle.");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => { console.error(e); process.exit(1); });
