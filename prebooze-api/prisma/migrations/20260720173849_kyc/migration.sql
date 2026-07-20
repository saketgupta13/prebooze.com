-- CreateEnum
CREATE TYPE "KycKind" AS ENUM ('guest', 'organizer', 'promoter', 'lineup', 'venue');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('pending', 'approved', 'rejected');

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "roleStatus" "KycStatus";

-- CreateTable
CREATE TABLE "KycSubmission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "kind" "KycKind" NOT NULL,
    "status" "KycStatus" NOT NULL DEFAULT 'pending',
    "payload" JSONB NOT NULL DEFAULT '{}',
    "documents" JSONB NOT NULL DEFAULT '[]',
    "autoScore" INTEGER,
    "reviewedBy" TEXT,
    "reviewNote" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "KycSubmission_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "KycSubmission" ADD CONSTRAINT "KycSubmission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
