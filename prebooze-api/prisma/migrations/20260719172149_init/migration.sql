-- CreateEnum
CREATE TYPE "ElevatedRole" AS ENUM ('organizer', 'promoter', 'lineup', 'venue');

-- CreateEnum
CREATE TYPE "AttendanceVisibility" AS ENUM ('off', 'followers', 'public');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT '',
    "username" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "city" TEXT NOT NULL DEFAULT '',
    "dob" TEXT NOT NULL DEFAULT '',
    "gender" TEXT NOT NULL DEFAULT '',
    "profession" TEXT NOT NULL DEFAULT '',
    "languages" TEXT NOT NULL DEFAULT '',
    "bio" TEXT NOT NULL DEFAULT '',
    "socials" TEXT NOT NULL DEFAULT '',
    "interests" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "phoneVerified" BOOLEAN NOT NULL DEFAULT true,
    "idVerified" BOOLEAN NOT NULL DEFAULT false,
    "profilePct" INTEGER NOT NULL DEFAULT 20,
    "role" "ElevatedRole",
    "orgBrand" TEXT,
    "orgUsername" TEXT,
    "lineupName" TEXT,
    "lineupCategory" TEXT,
    "lineupUsername" TEXT,
    "promoterBrand" TEXT,
    "promoterUsername" TEXT,
    "promoterPlan" TEXT,
    "venueName" TEXT,
    "venueId" TEXT,
    "attendanceVisibility" "AttendanceVisibility" NOT NULL DEFAULT 'off',
    "autoRenew" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_phone_key" ON "User"("phone");
