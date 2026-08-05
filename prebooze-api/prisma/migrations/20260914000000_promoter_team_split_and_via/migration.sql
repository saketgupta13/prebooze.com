-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "promoterVia" TEXT;

-- AlterTable
ALTER TABLE "PromoterTeamMember" ADD COLUMN     "monthlyQuotaShare" INTEGER,
ADD COLUMN     "payoutSplitPct" INTEGER NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "PromoterTeamSettlement" (
    "id" TEXT NOT NULL,
    "teamMemberId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PromoterTeamSettlement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoterTeamSettlement_teamMemberId_eventId_key" ON "PromoterTeamSettlement"("teamMemberId", "eventId");

-- AddForeignKey
ALTER TABLE "PromoterTeamSettlement" ADD CONSTRAINT "PromoterTeamSettlement_teamMemberId_fkey" FOREIGN KEY ("teamMemberId") REFERENCES "PromoterTeamMember"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterTeamSettlement" ADD CONSTRAINT "PromoterTeamSettlement_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
