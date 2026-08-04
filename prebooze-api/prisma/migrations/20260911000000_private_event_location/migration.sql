-- DropForeignKey
ALTER TABLE "Event" DROP CONSTRAINT "Event_venueId_fkey";

-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "privateCity" TEXT,
ADD COLUMN     "privateLocality" TEXT,
ALTER COLUMN "venueId" DROP NOT NULL;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE SET NULL ON UPDATE CASCADE;
