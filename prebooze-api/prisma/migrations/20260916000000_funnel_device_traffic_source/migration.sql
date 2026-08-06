-- AlterTable
ALTER TABLE "FunnelEvent" ADD COLUMN     "device" TEXT,
ADD COLUMN     "browser" TEXT,
ADD COLUMN     "os" TEXT,
ADD COLUMN     "referrerHost" TEXT,
ADD COLUMN     "utmSource" TEXT,
ADD COLUMN     "utmMedium" TEXT,
ADD COLUMN     "utmCampaign" TEXT,
ADD COLUMN     "landingPath" TEXT;
