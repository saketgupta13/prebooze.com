-- CreateTable
CREATE TABLE "VenuePaymentProfile" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "legalName" TEXT NOT NULL,
    "businessAddress" TEXT NOT NULL,
    "country" TEXT,
    "state" TEXT,
    "city" TEXT,
    "pincode" TEXT,
    "bankAccountNumber" TEXT NOT NULL,
    "bankLast4" TEXT NOT NULL,
    "accountHolderName" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "branch" TEXT,
    "pan" TEXT NOT NULL,
    "gstin" TEXT,
    "noGst" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenuePaymentProfile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VenuePaymentProfile" ADD CONSTRAINT "VenuePaymentProfile_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DataMigration: carry any existing venue's bank/PAN fields into a default
-- VenuePaymentProfile before the source columns are dropped below. No
-- self-serve or admin UI has ever written pan/gstin on Venue, so those stay
-- blank for the venue to fill in later, same as the organizer migration
-- this mirrors.
INSERT INTO "VenuePaymentProfile" (
    "id", "venueId", "isDefault", "legalName", "businessAddress",
    "bankAccountNumber", "bankLast4", "accountHolderName", "ifsc", "pan", "noGst",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text, "id", true, COALESCE(NULLIF("accountHolderName", ''), "name"), '',
    "bankAccountNumber", COALESCE(NULLIF("bankLast4", ''), right("bankAccountNumber", 4)),
    COALESCE(NULLIF("accountHolderName", ''), "name"), COALESCE("ifsc", ''), '', true,
    now(), now()
FROM "Venue"
WHERE "bankAccountNumber" IS NOT NULL AND "bankAccountNumber" != '';

-- AlterTable
ALTER TABLE "Venue" DROP COLUMN "bankLast4",
DROP COLUMN "bankName",
DROP COLUMN "bankAccountNumber",
DROP COLUMN "accountHolderName",
DROP COLUMN "ifsc";

-- AlterTable
ALTER TABLE "VenueLedgerTx" ADD COLUMN     "paymentProfileId" TEXT,
ADD COLUMN     "payoutBankLast4" TEXT,
ADD COLUMN     "payoutAccountHolderName" TEXT,
ADD COLUMN     "payoutIfsc" TEXT;
