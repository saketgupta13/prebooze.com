ALTER TABLE "Booking" ADD COLUMN "razorpayFeeReconciled" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "RazorpaySettlement" (
  "id" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "status" TEXT NOT NULL,
  "utr" TEXT,
  "settledAt" TIMESTAMP(3) NOT NULL,
  "fetchedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "RazorpaySettlement_pkey" PRIMARY KEY ("id")
);
