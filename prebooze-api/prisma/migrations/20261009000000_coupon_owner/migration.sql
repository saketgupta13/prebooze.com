-- Set only on a personally-earned reward (profile-completion coupons) — null
-- for a genuine platform-wide/organizer/venue coupon meant for anyone. Real
-- bug this closes: every guest could see and actually redeem every other
-- guest's own earned reward code, since organizerId/venueId null was being
-- read as "anyone can use this."
ALTER TABLE "Coupon" ADD COLUMN     "userId" TEXT;

-- AddForeignKey
ALTER TABLE "Coupon" ADD CONSTRAINT "Coupon_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
