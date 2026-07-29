-- AlterTable
ALTER TABLE "PayMethod" ADD COLUMN     "matchKey" TEXT,
ADD COLUMN     "usedCount" INTEGER NOT NULL DEFAULT 1;

-- CreateIndex
CREATE UNIQUE INDEX "PayMethod_userId_matchKey_key" ON "PayMethod"("userId", "matchKey");
