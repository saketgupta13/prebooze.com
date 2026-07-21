-- AlterTable
ALTER TABLE "Promoter" ADD COLUMN     "planId" TEXT NOT NULL DEFAULT 'free',
ADD COLUMN     "userId" TEXT;

-- CreateTable
CREATE TABLE "PromoterGuest" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "promoterSlug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "age" TEXT NOT NULL,
    "gender" TEXT NOT NULL,
    "subPromoter" TEXT,
    "arrived" BOOLEAN NOT NULL DEFAULT false,
    "arrivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoterGuest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoterTeamMember" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "handle" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoterTeamMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PromoterWithdrawal" (
    "id" TEXT NOT NULL,
    "promoterId" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PromoterWithdrawal_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "PromoterTeamMember_promoterId_handle_key" ON "PromoterTeamMember"("promoterId", "handle");

-- CreateIndex
CREATE UNIQUE INDEX "Promoter_userId_key" ON "Promoter"("userId");

-- AddForeignKey
ALTER TABLE "Promoter" ADD CONSTRAINT "Promoter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterGuest" ADD CONSTRAINT "PromoterGuest_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterTeamMember" ADD CONSTRAINT "PromoterTeamMember_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PromoterWithdrawal" ADD CONSTRAINT "PromoterWithdrawal_promoterId_fkey" FOREIGN KEY ("promoterId") REFERENCES "Promoter"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

