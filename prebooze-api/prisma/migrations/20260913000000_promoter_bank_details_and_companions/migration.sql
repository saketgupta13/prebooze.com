-- AlterTable
ALTER TABLE "Promoter" ADD COLUMN     "accountHolderName" TEXT,
ADD COLUMN     "audienceReach" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "bankLast4" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "ifsc" TEXT;

-- AlterTable
ALTER TABLE "PromoterGuest" ADD COLUMN     "companions" JSONB NOT NULL DEFAULT '[]';
