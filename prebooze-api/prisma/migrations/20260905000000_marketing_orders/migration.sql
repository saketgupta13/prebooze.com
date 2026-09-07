-- AlterTable
ALTER TABLE "FunnelEvent" ADD COLUMN     "utmCity" TEXT;

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "marketingPerEvent" INTEGER NOT NULL DEFAULT 5000,
ADD COLUMN     "marketingMonthly" INTEGER NOT NULL DEFAULT 15000,
ADD COLUMN     "marketingMarginPct" INTEGER NOT NULL DEFAULT 25;

-- CreateEnum
CREATE TYPE "MarketingOwnerType" AS ENUM ('organizer', 'venue');

-- CreateTable
CREATE TABLE "MarketingSubscription" (
    "id" TEXT NOT NULL,
    "ownerType" "MarketingOwnerType" NOT NULL,
    "organizerId" TEXT,
    "venueId" TEXT,
    "amountPerCycle" INTEGER NOT NULL,
    "marginPct" INTEGER NOT NULL,
    "razorpaySubId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'created',
    "shortUrl" TEXT,
    "currentStart" TIMESTAMP(3),
    "currentEnd" TIMESTAMP(3),
    "paidCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketingSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MarketingOrder" (
    "id" TEXT NOT NULL,
    "ownerType" "MarketingOwnerType" NOT NULL,
    "organizerId" TEXT,
    "venueId" TEXT,
    "eventId" TEXT,
    "eventTitle" TEXT,
    "amount" INTEGER NOT NULL,
    "marginPct" INTEGER NOT NULL,
    "status" "FeaturedStatus" NOT NULL DEFAULT 'pending',
    "metaCampaignId" TEXT,
    "razorpayOrderId" TEXT,
    "paymentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "marketingSubscriptionId" TEXT,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),

    CONSTRAINT "MarketingOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSubscription_organizerId_key" ON "MarketingSubscription"("organizerId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSubscription_venueId_key" ON "MarketingSubscription"("venueId");

-- CreateIndex
CREATE UNIQUE INDEX "MarketingSubscription_razorpaySubId_key" ON "MarketingSubscription"("razorpaySubId");

-- AddForeignKey
ALTER TABLE "MarketingSubscription" ADD CONSTRAINT "MarketingSubscription_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingSubscription" ADD CONSTRAINT "MarketingSubscription_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingOrder" ADD CONSTRAINT "MarketingOrder_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingOrder" ADD CONSTRAINT "MarketingOrder_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketingOrder" ADD CONSTRAINT "MarketingOrder_marketingSubscriptionId_fkey" FOREIGN KEY ("marketingSubscriptionId") REFERENCES "MarketingSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
