-- AlterTable
ALTER TABLE "TicketTier" ADD COLUMN "coverCharge" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "TicketTier" ADD COLUMN "coverChargeNote" TEXT;

-- AlterTable
ALTER TABLE "Booking" ADD COLUMN "coverCharge" INTEGER NOT NULL DEFAULT 0;
