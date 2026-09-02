-- Değerlendirme kartı — additive şema. Supabase SQL editöründe elle çalıştırılır.
-- Mevcut hiçbir kolonu değiştirmez, hiçbir veriyi silmez.
-- Bu dosya güvenle birden fazla kez çalıştırılabilir (idempotent).
--
-- reportData: ===JSON_DATA=== bloğunun tamamı. sectionScores ve weakCriteria
-- kolonları KALDIRILMIYOR — /api/scores/trend, criterionOccurrences ve OKR
-- sorguları onlara bağlı; kod her ikisini de yazmaya devam ediyor.
--
-- Nullable olduğu için mevcut satırlar NULL kalır ve kart onlarda eski
-- weakCriteria verisine düşerek çalışmaya devam eder.

ALTER TABLE "Evaluation" ADD COLUMN IF NOT EXISTS "reportData" JSONB;
