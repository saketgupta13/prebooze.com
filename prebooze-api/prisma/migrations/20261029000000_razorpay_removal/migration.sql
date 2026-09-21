-- Drop Razorpay subscription tables and models
DROP TABLE IF EXISTS "FeaturedSubscription" CASCADE;
DROP TABLE IF EXISTS "MarketingSubscription" CASCADE;
DROP TABLE IF EXISTS "RoleSubscription" CASCADE;
DROP TABLE IF EXISTS "SubscriptionCharge" CASCADE;
DROP TABLE IF EXISTS "SubscriptionPlan" CASCADE;
DROP TABLE IF EXISTS "RazorpayPlan" CASCADE;
DROP TABLE IF EXISTS "RazorpaySubscription" CASCADE;

-- Drop featured subscription relationship from Featured table
ALTER TABLE "Featured" DROP CONSTRAINT IF EXISTS "Featured_featuredSubscriptionId_fkey";
ALTER TABLE "Featured" DROP COLUMN IF EXISTS "featuredSubscriptionId";

-- Drop marketing subscription relationship  
ALTER TABLE "MarketingOrder" DROP CONSTRAINT IF EXISTS "MarketingOrder_marketingSubscriptionId_fkey";
ALTER TABLE "MarketingOrder" DROP COLUMN IF EXISTS "marketingSubscriptionId";
ALTER TABLE "MarketingOrder" DROP COLUMN IF EXISTS "isSubscriptionPeriod";
ALTER TABLE "MarketingOrder" DROP COLUMN IF EXISTS "periodStart";
