-- Featured/Marketing one-time purchases moving from Razorpay to PhonePe —
-- razorpayOrderId stays for legacy rows, new orders populate this instead.
ALTER TABLE "Featured" ADD COLUMN "phonepeMerchantOrderId" TEXT;
ALTER TABLE "MarketingOrder" ADD COLUMN "phonepeMerchantOrderId" TEXT;
