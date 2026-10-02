-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN "commissionGstPct" INTEGER NOT NULL DEFAULT 18;
ALTER TABLE "PlatformSettings" ADD COLUMN "tcsEnabled" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "PlatformSettings" ADD COLUMN "tcsPct" INTEGER NOT NULL DEFAULT 1;
