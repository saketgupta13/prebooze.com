-- Both nullable, both null by default — every existing tier is completely
-- unaffected; the effective-price calculation only engages when a tier has
-- freeCutoff set explicitly.
ALTER TABLE "TicketTier" ADD COLUMN "freeCutoff" TEXT;
ALTER TABLE "TicketTier" ADD COLUMN "lateFeePrice" INTEGER;
