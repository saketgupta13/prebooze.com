-- AlterTable
ALTER TABLE "Featured" ADD COLUMN     "expiryReminderSentAt" TIMESTAMP(3),
ADD COLUMN     "paid" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "paymentId" TEXT,
ADD COLUMN     "razorpayOrderId" TEXT;
