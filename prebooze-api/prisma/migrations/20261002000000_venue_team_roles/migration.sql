-- CreateTable
CREATE TABLE "VenueRole" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VenueStaff" (
    "id" TEXT NOT NULL,
    "venueId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "roleName" TEXT NOT NULL,
    "scan" BOOLEAN NOT NULL DEFAULT false,
    "userId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VenueStaff_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "VenueRole_venueId_name_key" ON "VenueRole"("venueId", "name");

-- CreateIndex
CREATE INDEX "VenueStaff_userId_idx" ON "VenueStaff"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "VenueStaff_venueId_phone_key" ON "VenueStaff"("venueId", "phone");

-- AddForeignKey
ALTER TABLE "VenueRole" ADD CONSTRAINT "VenueRole_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueStaff" ADD CONSTRAINT "VenueStaff_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VenueStaff" ADD CONSTRAINT "VenueStaff_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
