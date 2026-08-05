-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "promoterCommission" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PromoterEventSettlement" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "reminderSentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoterEventSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoterEventSettlement_promoterId_eventId_key" ON "PromoterEventSettlement"("promoterId", "eventId");

-- AddForeignKey
ALTER TABLE "PromoterEventSettlement" ADD CONSTRAINT "PromoterEventSettlement_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterEventSettlement" ADD CONSTRAINT "PromoterEventSettlement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
