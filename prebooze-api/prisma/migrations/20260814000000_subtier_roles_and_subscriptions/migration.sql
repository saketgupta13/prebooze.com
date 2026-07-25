-- CreateEnum
CREATE TYPE "SubTierRole" AS ENUM ('organizer', 'promoter', 'venue');

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('created', 'authenticated', 'active', 'pending', 'halted', 'cancelled', 'completed', 'expired');

-- AlterTable
ALTER TABLE "SubTier" ADD COLUMN     "razorpayPlanId" TEXT,
ADD COLUMN     "role" "SubTierRole" NOT NULL DEFAULT 'promoter',
ALTER COLUMN "guests" DROP NOT NULL;

-- CreateTable
CREATE TABLE "RoleSubscription" (
    "id" TEXT NOT NULL,
    "role" "SubTierRole" NOT NULL,
    "entityId" TEXT NOT NULL,
    "tierId" TEXT NOT NULL,
    "razorpaySubId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'created',
    "shortUrl" TEXT,
    "currentStart" TIMESTAMP(3),
    "currentEnd" TIMESTAMP(3),
    "paidCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoleSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubscriptionCharge" (
    "id" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "razorpayPaymentId" TEXT,
    "amount" INTEGER NOT NULL,
    "status" TEXT NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SubscriptionCharge_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "RoleSubscription_razorpaySubId_key" ON "RoleSubscription"("razorpaySubId");

-- CreateIndex
CREATE UNIQUE INDEX "RoleSubscription_role_entityId_key" ON "RoleSubscription"("role", "entityId");

-- AddForeignKey
ALTER TABLE "RoleSubscription" ADD CONSTRAINT "RoleSubscription_tierId_fkey" FOREIGN KEY ("tierId") REFERENCES "SubTier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubscriptionCharge" ADD CONSTRAINT "SubscriptionCharge_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "RoleSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
