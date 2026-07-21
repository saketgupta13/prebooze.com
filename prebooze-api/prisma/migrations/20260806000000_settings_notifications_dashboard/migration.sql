-- AlterTable
ALTER TABLE "PlatformSettings" ADD COLUMN     "absorbedBy" TEXT NOT NULL DEFAULT 'Organizer',
ADD COLUMN     "autoPayout" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "contact" JSONB NOT NULL DEFAULT '{"email":"","phone":"","address":"","organizerEmail":""}',
ADD COLUMN     "feeLabel" TEXT NOT NULL DEFAULT 'Convenience fee',
ADD COLUMN     "footerCopyright" TEXT NOT NULL DEFAULT '',
ADD COLUMN     "maintenanceMode" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "payoutDay" TEXT NOT NULL DEFAULT 'Friday',
ADD COLUMN     "require2fa" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "salesPaused" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "siteSeo" JSONB NOT NULL DEFAULT '{"title":"","description":"","keywords":""}',
ADD COLUMN     "socials" JSONB NOT NULL DEFAULT '{"instagram":"","x":"","youtube":"","whatsapp":"","facebook":""}',
ADD COLUMN     "weeklyEmail" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "whatsappAlerts" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "AdminNotification" (
    "id" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "text" TEXT NOT NULL,
    "to" TEXT,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdminNotification_pkey" PRIMARY KEY ("id")
);

