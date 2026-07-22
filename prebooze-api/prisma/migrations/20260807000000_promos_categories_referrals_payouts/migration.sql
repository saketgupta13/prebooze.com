-- AlterTable
ALTER TABLE "Coupon" ADD COLUMN     "gender" TEXT NOT NULL DEFAULT 'all';

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "payoutUtr" TEXT,
ADD COLUMN     "posterUrl" TEXT;

-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "referralReferee" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "referralReferrer" INTEGER NOT NULL DEFAULT 100;

-- CreateTable
CREATE TABLE "EventCategory" (
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL DEFAULT '🏷',
    "imageUrl" TEXT,
    "seo" JSONB,

    CONSTRAINT "EventCategory_pkey" PRIMARY KEY ("name")
);

