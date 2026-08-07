-- Event: organizerId becomes optional, new hostedByVenue flag
ALTER TABLE "Event" ALTER COLUMN "organizerId" DROP NOT NULL;
ALTER TABLE "Event" ADD COLUMN     "hostedByVenue" BOOLEAN NOT NULL DEFAULT false;

-- Venue: hosting gate + payout details
ALTER TABLE "Venue" ADD COLUMN     "hostingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hostingRequestedAt" TIMESTAMP(3),
ADD COLUMN     "bankLast4" TEXT,
ADD COLUMN     "bankName" TEXT,
ADD COLUMN     "bankAccountNumber" TEXT,
ADD COLUMN     "accountHolderName" TEXT,
ADD COLUMN     "ifsc" TEXT;

-- CreateTable
CREATE TABLE "VenueHostingRequest" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "contactedAt" TIMESTAMP(3),
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueHostingRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueLedgerTx" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "eventId" TEXT,
    "eventTitle" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VenueLedgerTx_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "VenueHostingRequest" ADD CONSTRAINT "VenueHostingRequest_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueLedgerTx" ADD CONSTRAINT "VenueLedgerTx_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
