-- CreateTable
CREATE TABLE "PhonePeSettlement" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "state" TEXT NOT NULL,
    "utr" TEXT,
    "merchantId" TEXT,
    "lastAttemptErrorCode" TEXT,
    "lastAttemptErrorDescription" TEXT,
    "settledAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PhonePeSettlement_pkey" PRIMARY KEY ("id")
);
