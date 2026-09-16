-- AlterTable
ALTER TABLE "OrganizerLedgerTx" ADD COLUMN     "withdrawalStatus" TEXT NOT NULL DEFAULT 'requested',
ADD COLUMN     "withdrawalRejectedReason" TEXT;

-- AlterTable
ALTER TABLE "VenueLedgerTx" ADD COLUMN     "withdrawalStatus" TEXT NOT NULL DEFAULT 'requested',
ADD COLUMN     "withdrawalRejectedReason" TEXT;

-- CreateTable
CREATE TABLE "PayoutStatusEvent" (
    "id" TEXT NOT NULL,
    "payeeType" TEXT NOT NULL,
    "payeeId" TEXT NOT NULL,
    "ledgerTxId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "utr" TEXT,
    "staffEmail" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PayoutStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PayoutStatusEvent_ledgerTxId_idx" ON "PayoutStatusEvent"("ledgerTxId");

-- CreateIndex
CREATE INDEX "PayoutStatusEvent_payeeType_payeeId_idx" ON "PayoutStatusEvent"("payeeType", "payeeId");

-- Backfill: existing withdrawal rows already marked paid become 'complete';
-- everything else defaults to 'requested', which the ADD COLUMN default
-- above already applied to every row (harmless for type sale/refund rows,
-- since withdrawalStatus is only ever read for type:'withdrawal').
UPDATE "OrganizerLedgerTx" SET "withdrawalStatus" = 'complete' WHERE "type" = 'withdrawal' AND "withdrawalPaidOut" = true;
UPDATE "VenueLedgerTx" SET "withdrawalStatus" = 'complete' WHERE "type" = 'withdrawal' AND "withdrawalPaidOut" = true;

-- Backfill one PayoutStatusEvent per existing withdrawal row so the new
-- tracking timeline isn't empty for history that predates this feature —
-- staffEmail is left NULL since who actually made each past transition was
-- never recorded before now.
INSERT INTO "PayoutStatusEvent" ("id", "payeeType", "payeeId", "ledgerTxId", "status", "utr", "createdAt")
SELECT gen_random_uuid()::text, 'organizer', "organizerId", "id", "withdrawalStatus", "withdrawalPaidUtr", "createdAt"
FROM "OrganizerLedgerTx" WHERE "type" = 'withdrawal';

INSERT INTO "PayoutStatusEvent" ("id", "payeeType", "payeeId", "ledgerTxId", "status", "utr", "createdAt")
SELECT gen_random_uuid()::text, 'venue', "venueId", "id", "withdrawalStatus", "withdrawalPaidUtr", "createdAt"
FROM "VenueLedgerTx" WHERE "type" = 'withdrawal';
