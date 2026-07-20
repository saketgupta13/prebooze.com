-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('approved', 'pending', 'rejected', 'draft');

-- CreateEnum
CREATE TYPE "FeaturedType" AS ENUM ('event', 'organizer', 'promoter', 'lineup', 'venue');

-- CreateEnum
CREATE TYPE "FeaturedStatus" AS ENUM ('pending', 'active', 'rejected', 'expired');

-- CreateEnum
CREATE TYPE "FeaturedBilling" AS ENUM ('per_event', 'monthly');

-- CreateTable
CREATE TABLE "Venue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "type" TEXT NOT NULL,
    "locality" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "amenities" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "about" TEXT NOT NULL,
    "timings" TEXT,
    "photoHue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Venue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Organizer" (
    "id" TEXT NOT NULL,
    "brandName" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "city" TEXT NOT NULL,
    "since" TEXT NOT NULL,
    "rating" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "reviewCount" INTEGER NOT NULL DEFAULT 0,
    "eventsHosted" INTEGER NOT NULL DEFAULT 0,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "following" INTEGER NOT NULL DEFAULT 0,
    "about" TEXT NOT NULL,
    "logoHue" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organizer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Promoter" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "city" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "followers" INTEGER NOT NULL DEFAULT 0,
    "eventsPromoted" INTEGER NOT NULL DEFAULT 0,
    "guestsBrought" INTEGER NOT NULL DEFAULT 0,
    "showRate" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Promoter_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Lineup" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "city" TEXT NOT NULL,
    "bio" TEXT NOT NULL,
    "links" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "followers" INTEGER NOT NULL DEFAULT 0,
    "eventsPlayed" INTEGER NOT NULL DEFAULT 0,
    "hue" INTEGER NOT NULL,
    "emoji" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Lineup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Person" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "avatarHue" INTEGER NOT NULL,
    "bio" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "followers" INTEGER NOT NULL DEFAULT 0,
    "follows" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Category" (
    "name" TEXT NOT NULL,
    "icon" TEXT NOT NULL,
    "subs" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "City" (
    "name" TEXT NOT NULL,
    "icon" TEXT,
    "top" BOOLEAN NOT NULL DEFAULT false,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "City_pkey" PRIMARY KEY ("name")
);

-- CreateTable
CREATE TABLE "TrendingSearch" (
    "term" TEXT NOT NULL,
    "sort" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "TrendingSearch_pkey" PRIMARY KEY ("term")
);

-- CreateTable
CREATE TABLE "Event" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "subCategory" TEXT,
    "ageLimit" TEXT NOT NULL,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "date" TIMESTAMP(3) NOT NULL,
    "durationHrs" DOUBLE PRECISION NOT NULL,
    "venueId" TEXT NOT NULL,
    "organizerId" TEXT NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT,
    "conditions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "rules" JSONB NOT NULL DEFAULT '[]',
    "lineup" JSONB NOT NULL DEFAULT '[]',
    "posterHue" INTEGER NOT NULL,
    "seo" JSONB,
    "promoterConfig" JSONB,
    "socialBanners" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TicketTier" (
    "id" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "sold" INTEGER NOT NULL DEFAULT 0,
    "includes" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "description" TEXT,

    CONSTRAINT "TicketTier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Featured" (
    "id" TEXT NOT NULL,
    "type" "FeaturedType" NOT NULL,
    "refId" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "status" "FeaturedStatus" NOT NULL DEFAULT 'pending',
    "billing" "FeaturedBilling" NOT NULL,
    "amount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Featured_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Organizer_username_key" ON "Organizer"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Promoter_slug_key" ON "Promoter"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Lineup_slug_key" ON "Lineup"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "Person_username_key" ON "Person"("username");

-- CreateIndex
CREATE UNIQUE INDEX "Event_slug_key" ON "Event"("slug");

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_venueId_fkey" FOREIGN KEY ("venueId") REFERENCES "Venue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Event" ADD CONSTRAINT "Event_organizerId_fkey" FOREIGN KEY ("organizerId") REFERENCES "Organizer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TicketTier" ADD CONSTRAINT "TicketTier_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
