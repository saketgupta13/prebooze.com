-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'refund_requested';

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "blocked" BOOLEAN NOT NULL DEFAULT false;

