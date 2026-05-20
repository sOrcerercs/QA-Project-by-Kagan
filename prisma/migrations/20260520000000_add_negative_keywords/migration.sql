CREATE TABLE "NegativeKeyword" (
    "id" TEXT NOT NULL,
    "word" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "NegativeKeyword_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "NegativeKeyword_word_key" ON "NegativeKeyword"("word");
