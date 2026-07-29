-- AlterTable
ALTER TABLE "LedgerEntry" ADD COLUMN     "eventId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "LedgerEntry_eventId_category_key" ON "LedgerEntry"("eventId", "category");
