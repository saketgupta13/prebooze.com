-- AlterTable
ALTER TABLE "Event" ADD COLUMN     "salesPaused" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "GuestListEntry" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "plusOnes" INTEGER NOT NULL DEFAULT 0,
    "companions" JSONB NOT NULL DEFAULT '[]',
    "addedBy" TEXT NOT NULL,
    "arrived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GuestListEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CheckInLog" (
    "id" TEXT NOT NULL,
    "eventId" TEXT,
    "bookingId" TEXT,
    "ok" BOOLEAN NOT NULL,
    "reason" TEXT NOT NULL,
    "guestName" TEXT,
    "tierName" TEXT,
    "headcount" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CheckInLog_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "GuestListEntry" ADD CONSTRAINT "GuestListEntry_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CheckInLog" ADD CONSTRAINT "CheckInLog_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE SET NULL ON UPDATE CASCADE;

