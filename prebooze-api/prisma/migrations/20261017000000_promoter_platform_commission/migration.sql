ALTER TABLE "Booking" ADD COLUMN "promoterPlatformCommission" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "Booking" ADD COLUMN "promoterPlatformCommissionPaidOut" BOOLEAN NOT NULL DEFAULT false;
