-- AlterTable
ALTER TABLE "OrganizerLedgerTx" ADD COLUMN     "withdrawalRejectionResolved" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "VenueLedgerTx" ADD COLUMN     "withdrawalRejectionResolved" BOOLEAN NOT NULL DEFAULT false;
