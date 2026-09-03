-- Düşünmeli yeniden değerlendirme işaretleyicileri.
-- Additive; Supabase SQL editöründe elle çalıştırılır. Tekrar çalıştırılabilir.
-- prisma migrate / db push ÇALIŞTIRMA — bu veritabanı prod.
--
-- deepScoredAt      : düşünme AÇIK üretilmiş kaydın damgası.
--                     NULL = bu kayıt düşünmeli üretilmedi.
--                     Neden ayrı kolon: reportData varlığı "düşünmeli üretildi"
--                     ANLAMINA GELMİYOR — blok, düşünme kapalıyken de üretiliyor.
--                     2 Eylül'de tam bu yüzden hangi kaydın işlendiğini
--                     veritabanından okuyamayıp görev loglarından çıkarmak
--                     zorunda kaldık.
--
-- deepScoreLockedAt : işleme alındı kilidi. İki paralel istek aynı kaydı
--                     işlemesin diye. Başarıda/hatada temizlenir; 5 dakikadan
--                     eski kilit ölü sayılır ve yeniden alınabilir.
--
-- deepScoreAttempts : kaç kez denendi. ÖLÇÜLDÜ: prod'da tek düşünmeli çağrı
--                     ~52 sn, Vercel Hobby tavanı 60 sn, kayıtların ~%28'i
--                     aşıyor. Uzun transkriptli bir kayıt HER denemede
--                     aşabilir; sayaç olmasa kuyruğu sonsuza kadar tıkardı.
--
-- KAPSAM: kuyruk yalnızca 3 Eylül 2026'dan İTİBAREN çağrıları kapsar.
-- Öncesindeki ~4400 kayıt bilinçli olarak kapsam dışı (kullanıcı kararı).
-- Bu sınır VERİYE değil KODA yazılıdır — app/lib/deepScore.ts içindeki
-- DEEP_SCORE_FROM sabiti. Böylece eski kayıtlar "düşünmeli üretilmedi"
-- gerçeğini korur; yalnızca kuyruk onları görmez.

ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "deepScoredAt"      TIMESTAMP(3);
ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "deepScoreLockedAt" TIMESTAMP(3);
ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "deepScoreAttempts" INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS "Evaluation_deepScoredAt_callDate_idx"
  ON "Evaluation"("deepScoredAt", "callDate");

-- 1-2 Eylül'ün 87 kaydı gerçekten düşünmeli üretildi; damgayı doğru olduğu
-- için yazıyoruz. Kuyruk zaten 3 Eylül'den başladığı için bu satır kuyruğu
-- etkilemiyor — kayıt geçmişinin doğru olması için.
UPDATE "Evaluation"
   SET "deepScoredAt" = NOW()
 WHERE "deepScoredAt" IS NULL
   AND "callDate" >= TIMESTAMP WITH TIME ZONE '2026-09-01 00:00:00+03'
   AND "callDate" <  TIMESTAMP WITH TIME ZONE '2026-09-03 00:00:00+03';
