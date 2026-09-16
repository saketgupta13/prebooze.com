-- AlterTable
ALTER TABLE "VenueLedgerTx" ADD COLUMN     "withdrawalPaidOut" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "withdrawalPaidUtr" TEXT;
