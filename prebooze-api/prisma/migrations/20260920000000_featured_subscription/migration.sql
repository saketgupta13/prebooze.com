-- CreateTable
CREATE TABLE "FeaturedSubscription" (
    "id" TEXT NOT NULL,
    "type" "FeaturedType" NOT NULL,
    "refId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "gstPct" DOUBLE PRECISION NOT NULL,
    "gstAmount" INTEGER NOT NULL,
    "total" INTEGER NOT NULL,
    "razorpaySubId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'created',
    "shortUrl" TEXT,
    "currentStart" TIMESTAMP(3),
    "currentEnd" TIMESTAMP(3),
    "paidCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeaturedSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedSubscription_razorpaySubId_key" ON "FeaturedSubscription"("razorpaySubId");

-- CreateIndex
CREATE UNIQUE INDEX "FeaturedSubscription_type_refId_key" ON "FeaturedSubscription"("type", "refId");

-- AlterTable
ALTER TABLE "Featured" ADD COLUMN     "featuredSubscriptionId" TEXT;

-- AddForeignKey
ALTER TABLE "Featured" ADD CONSTRAINT "Featured_featuredSubscriptionId_fkey" FOREIGN KEY ("featuredSubscriptionId") REFERENCES "FeaturedSubscription"("id") ON DELETE SET NULL ON UPDATE CASCADE;
