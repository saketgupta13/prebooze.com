-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "contactPersonPhone" TEXT,
ADD COLUMN     "socialLinks" JSONB;

-- CreateTable
CREATE TABLE "VenueType" (
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "VenueType_pkey" PRIMARY KEY ("name")
);
