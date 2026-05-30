-- AlterTable User
ALTER TABLE "User" ADD COLUMN "lastLoginAt" TIMESTAMP(3);

-- AlterTable ActivityLog
ALTER TABLE "ActivityLog" ADD COLUMN "section" TEXT;

-- AlterTable Evaluation (Kriko)
ALTER TABLE "Evaluation" ADD COLUMN "externalCallId" TEXT;
ALTER TABLE "Evaluation" ADD COLUMN "externalAgentName" TEXT;
ALTER TABLE "Evaluation" ADD COLUMN "recordingUrl" TEXT;
ALTER TABLE "Evaluation" ADD COLUMN "unassigned" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Evaluation" ADD COLUMN "source" TEXT NOT NULL DEFAULT 'MANUAL';

-- CreateIndex
CREATE UNIQUE INDEX "Evaluation_externalCallId_key" ON "Evaluation"("externalCallId");

-- CreateTable SyncLog
CREATE TABLE "SyncLog" (
    "id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "date" TEXT NOT NULL,
    "totalFetched" INTEGER NOT NULL DEFAULT 0,
    "imported" INTEGER NOT NULL DEFAULT 0,
    "skipped" INTEGER NOT NULL DEFAULT 0,
    "unassigned" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "trigger" TEXT NOT NULL DEFAULT 'MANUAL',
    CONSTRAINT "SyncLog_pkey" PRIMARY KEY ("id")
);
