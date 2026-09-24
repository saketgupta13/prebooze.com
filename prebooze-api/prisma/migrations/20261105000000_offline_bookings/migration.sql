-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "bookingSource" TEXT NOT NULL DEFAULT 'online',
ADD COLUMN "offlinePaymentMode" TEXT;

-- AlterTable
ALTER TABLE "OrganizerLedgerTx" ADD COLUMN "bookingId" TEXT;
