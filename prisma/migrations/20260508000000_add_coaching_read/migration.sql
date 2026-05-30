-- AlterTable Evaluation (agent read + coaching)
ALTER TABLE "Evaluation" ADD COLUMN "agentRead" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Evaluation" ADD COLUMN "agentReadAt" TIMESTAMP(3);
ALTER TABLE "Evaluation" ADD COLUMN "coachingDone" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Evaluation" ADD COLUMN "coachingDoneAt" TIMESTAMP(3);
ALTER TABLE "Evaluation" ADD COLUMN "coachingNotes" TEXT;
ALTER TABLE "Evaluation" ADD COLUMN "coachingById" TEXT;
ALTER TABLE "Evaluation" ADD COLUMN "coachingByName" TEXT;
