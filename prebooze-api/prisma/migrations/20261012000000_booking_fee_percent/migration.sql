ALTER TABLE "PlatformSettings" ALTER COLUMN "bookingFee" SET DEFAULT 3;

-- bookingFee's meaning changed from a flat ₹ amount per ticket to a % of
-- the discounted subtotal — the existing row's value (5, meaning ₹5) no
-- longer means anything as a percentage, so it's reset to the new default.
UPDATE "PlatformSettings" SET "bookingFee" = 3 WHERE id = 'main';
