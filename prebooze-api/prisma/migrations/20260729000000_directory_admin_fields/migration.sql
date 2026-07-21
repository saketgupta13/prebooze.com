-- AlterTable
ALTER TABLE "Organizer" ADD COLUMN     "bankLast4" TEXT,
ADD COLUMN     "contact" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "contactPerson" TEXT,
ADD COLUMN     "eventTypes" TEXT,
ADD COLUMN     "gstin" TEXT,
ADD COLUMN     "links" TEXT,
ADD COLUMN     "pan" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "seo" JSONB;

-- AlterTable
ALTER TABLE "Promoter" ADD COLUMN     "contact" TEXT;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "contact" TEXT,
ADD COLUMN     "license" TEXT,
ADD COLUMN     "rules" TEXT,
ADD COLUMN     "seo" JSONB;

