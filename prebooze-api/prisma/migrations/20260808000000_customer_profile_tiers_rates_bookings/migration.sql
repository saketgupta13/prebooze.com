-- AlterTable
ALTER TABLE "Booking" ADD COLUMN     "paymentMethod" TEXT;

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "featuredLineupMonthly" INTEGER NOT NULL DEFAULT 1999,
ADD COLUMN     "featuredOrganizerMonthly" INTEGER NOT NULL DEFAULT 4999,
ADD COLUMN     "featuredPerEvent" INTEGER NOT NULL DEFAULT 2000,
ADD COLUMN     "featuredPromoterMonthly" INTEGER NOT NULL DEFAULT 2999,
ADD COLUMN     "featuredVenueMonthly" INTEGER NOT NULL DEFAULT 3999;

-- CreateTable
CREATE TABLE "SubTier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "guests" INTEGER NOT NULL,

    CONSTRAINT "SubTier_pkey" PRIMARY KEY ("id")
);

