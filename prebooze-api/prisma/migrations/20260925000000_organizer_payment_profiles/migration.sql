-- CreateTable
CREATE TABLE "PaymentProfile" (
    "id" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
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

    CONSTRAINT "PaymentProfile_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "PaymentProfile" ADD CONSTRAINT "PaymentProfile_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- DataMigration: carry every existing organizer's bank/PAN/GST fields into a
-- default PaymentProfile before the source columns are dropped below.
-- legalName falls back to accountHolderName (closer to a real "who this
-- payout belongs to" than the brand name); businessAddress has no prior
-- equivalent so it's left blank for the organizer to fill in later.
INSERT INTO "PaymentProfile" (
    "id", "organizerId", "isDefault", "legalName", "businessAddress",
    "country", "state", "city", "pincode",
    "bankAccountNumber", "bankLast4", "accountHolderName", "ifsc", "pan", "gstin", "noGst",
    "createdAt", "updatedAt"
)
SELECT
    gen_random_uuid()::text, "id", true, COALESCE(NULLIF("accountHolderName", ''), "brandName"), '',
    "country", "state", "city", "pincode",
    "bankAccountNumber", COALESCE(NULLIF("bankLast4", ''), right("bankAccountNumber", 4)),
    COALESCE(NULLIF("accountHolderName", ''), "brandName"), COALESCE("ifsc", ''),
    COALESCE(NULLIF("pan", ''), ''), NULLIF("gstin", ''), (NULLIF("gstin", '') IS NULL),
    now(), now()
FROM "Organizer"
WHERE "bankAccountNumber" IS NOT NULL AND "bankAccountNumber" != '';

-- AlterTable
ALTER TABLE "Organizer" DROP COLUMN "gstin",
DROP COLUMN "pan",
DROP COLUMN "bankLast4",
DROP COLUMN "bankName",
DROP COLUMN "bankAccountNumber",
DROP COLUMN "accountHolderName",
DROP COLUMN "ifsc";

-- AlterTable
ALTER TABLE "OrganizerLedgerTx" ADD COLUMN     "paymentProfileId" TEXT,
ADD COLUMN     "payoutBankLast4" TEXT,
ADD COLUMN     "payoutAccountHolderName" TEXT,
ADD COLUMN     "payoutIfsc" TEXT;
