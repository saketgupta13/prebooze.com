-- Records the exact merchantOrderId quote() minted for a cart's PhonePe
-- order, so the PhonePe webhook fallback can look a cart up by it (the only
-- durable record of that id outside the guest's own sessionStorage).
ALTER TABLE "Cart" ADD COLUMN "phonepeMerchantOrderId" TEXT;
