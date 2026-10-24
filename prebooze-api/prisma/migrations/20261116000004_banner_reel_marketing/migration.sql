-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "bannerMarketing3Day" INTEGER NOT NULL DEFAULT 1500,
ADD COLUMN     "bannerMarketing7Day" INTEGER NOT NULL DEFAULT 2500,
ADD COLUMN     "bannerMarketing15Day" INTEGER NOT NULL DEFAULT 4500,
ADD COLUMN     "bannerMarketing30Day" INTEGER NOT NULL DEFAULT 8000,
ADD COLUMN     "reelMarketing3Day" INTEGER NOT NULL DEFAULT 999,
ADD COLUMN     "reelMarketing7Day" INTEGER NOT NULL DEFAULT 1999,
ADD COLUMN     "reelMarketing15Day" INTEGER NOT NULL DEFAULT 3499,
ADD COLUMN     "reelMarketing30Day" INTEGER NOT NULL DEFAULT 5999;

-- AlterTable
ALTER TABLE "MarketingOrder" ADD COLUMN     "productType" TEXT NOT NULL DEFAULT 'ads',
ADD COLUMN     "creativeUrl" TEXT,
ADD COLUMN     "creativePosterUrl" TEXT,
ADD COLUMN     "days" INTEGER,
ADD COLUMN     "expiryReminderSentAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Banner" ADD COLUMN     "city" TEXT,
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "organizerId" TEXT,
ADD COLUMN     "venueId" TEXT,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "Reel" ADD COLUMN     "city" TEXT,
ADD COLUMN     "eventId" TEXT,
ADD COLUMN     "organizerId" TEXT,
ADD COLUMN     "venueId" TEXT,
ADD COLUMN     "orderId" TEXT,
ADD COLUMN     "expiresAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "Banner_orderId_key" ON "Banner"("orderId");

-- CreateIndex
CREATE UNIQUE INDEX "Reel_orderId_key" ON "Reel"("orderId");

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Banner" ADD CONSTRAINT "Banner_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Reel" ADD CONSTRAINT "Reel_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
