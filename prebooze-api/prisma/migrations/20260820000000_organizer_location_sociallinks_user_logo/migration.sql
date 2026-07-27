/*
  Warnings:

  - You are about to drop the column `links` on the `Organizer` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "Organizer" DROP COLUMN "links",
ADD COLUMN     "country" TEXT,
ADD COLUMN     "pincode" TEXT,
ADD COLUMN     "socialLinks" JSONB,
ADD COLUMN     "state" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "orgLogoUrl" TEXT;
