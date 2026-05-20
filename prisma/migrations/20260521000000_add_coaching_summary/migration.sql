CREATE TABLE "CoachingSummary" (
    "id" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "summary" TEXT,
    "actionItems" JSONB,
    "generatedAt" TIMESTAMP(3),
    "evalCount" INTEGER NOT NULL DEFAULT 0,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CoachingSummary_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "CoachingSummary_agentId_key" ON "CoachingSummary"("agentId");
