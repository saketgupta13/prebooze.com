-- GST activation (real GSTIN 27FDXPG4610R1ZO, activated 2026-09-21)
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "gstEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN IF NOT EXISTS "gstin" TEXT;

-- MarketingOrder: was missing gst columns entirely (unlike Featured, which
-- already had them from the earlier, never-activated GST-readiness pass)
ALTER TABLE "MarketingOrder" ADD COLUMN IF NOT EXISTS "gstPct" DOUBLE PRECISION;
ALTER TABLE "MarketingOrder" ADD COLUMN IF NOT EXISTS "gstAmount" INTEGER;
ALTER TABLE "MarketingOrder" ADD COLUMN IF NOT EXISTS "total" INTEGER;

-- Invoice: igstAmount>0 means show one IGST line for the full gstAmount;
-- 0 (every existing row) means split gstAmount into CGST+SGST instead.
ALTER TABLE "Invoice" ADD COLUMN IF NOT EXISTS "igstAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
