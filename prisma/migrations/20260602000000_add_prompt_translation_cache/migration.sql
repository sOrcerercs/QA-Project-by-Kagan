-- Add display-only English translation cache columns to Prompt
ALTER TABLE "Prompt" ADD COLUMN "contentEn" TEXT;
ALTER TABLE "Prompt" ADD COLUMN "contentEnHash" TEXT;
