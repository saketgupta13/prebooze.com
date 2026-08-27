-- Tracks a refund that was marked "refunded" in our system (inventory and
-- ledger reversal already committed) but where the real Razorpay refund
-- call to actually pay the guest back failed. Real incident this closes:
-- a guest was told their refund was on its way on 2026-08-14 and it
-- silently never was.
ALTER TABLE "Booking" ADD COLUMN     "refundFailedAt" TIMESTAMP(3);
