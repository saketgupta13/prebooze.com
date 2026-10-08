-- Widen PlatformSettings.tcsPct from Int to Float so it can hold the
-- correct 0.5% statutory TCS rate (was defaulting to the wrong 1%).
ALTER TABLE "PlatformSettings" ALTER COLUMN "tcsPct" TYPE DOUBLE PRECISION USING "tcsPct"::DOUBLE PRECISION;
ALTER TABLE "PlatformSettings" ALTER COLUMN "tcsPct" SET DEFAULT 0.5;

-- Correct any existing live row still holding the old 1% default.
UPDATE "PlatformSettings" SET "tcsPct" = 0.5 WHERE "tcsPct" = 1;
