-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "commission" INTEGER,
ADD COLUMN     "paidOut" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "PlatformSettings" (
    "id" TEXT NOT NULL DEFAULT 'main',
    "bookingFee" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "gstPct" INTEGER NOT NULL DEFAULT 18,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformSettings_pkey" PRIMARY KEY ("id")
);

