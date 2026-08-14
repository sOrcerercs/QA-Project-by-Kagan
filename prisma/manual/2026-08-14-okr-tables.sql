-- OKR paneli — additive şema. Supabase SQL editöründe elle çalıştırılır.
-- Mevcut hiçbir tabloyu değiştirmez, hiçbir veriyi silmez.
-- Bu dosya güvenle birden fazla kez çalıştırılabilir (idempotent).

CREATE TABLE IF NOT EXISTS "EvaluationUpsell" (
  "id"           TEXT NOT NULL,
  "evaluationId" TEXT NOT NULL,
  "stemCell"     TEXT NOT NULL,
  "premium"      TEXT NOT NULL,
  "source"       TEXT NOT NULL DEFAULT 'AI',
  "model"        TEXT,
  "classifiedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "EvaluationUpsell_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EvaluationUpsell_evaluationId_key"
  ON "EvaluationUpsell"("evaluationId");

DO $$ BEGIN
  ALTER TABLE "EvaluationUpsell"
    ADD CONSTRAINT "EvaluationUpsell_evaluationId_fkey"
    FOREIGN KEY ("evaluationId") REFERENCES "Evaluation"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "OkrBottomSeller" (
  "id"        TEXT NOT NULL,
  "month"     TEXT NOT NULL,
  "userId"    TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "OkrBottomSeller_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "OkrBottomSeller_month_userId_key"
  ON "OkrBottomSeller"("month", "userId");

CREATE INDEX IF NOT EXISTS "OkrBottomSeller_month_idx"
  ON "OkrBottomSeller"("month");
