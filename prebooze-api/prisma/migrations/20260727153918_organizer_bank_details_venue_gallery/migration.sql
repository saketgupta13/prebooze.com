-- AlterTable
ALTER TABLE "Organizer" ADD COLUMN     "accountHolderName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "ifsc" TEXT;

-- AlterTable
ALTER TABLE "Venue" ADD COLUMN     "galleryUrls" TEXT[] DEFAULT ARRAY[]::TEXT[];
