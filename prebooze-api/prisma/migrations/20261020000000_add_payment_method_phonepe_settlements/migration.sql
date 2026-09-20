-- Add paymentMethod to Booking
ALTER TABLE "Booking" ADD COLUMN "paymentMethod" TEXT;

-- Create PhonePe settlement tables
CREATE TABLE "PhonePeSettlementFile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fileDate" DATETIME NOT NULL,
  "downloadedAt" DATETIME NOT NULL,
  "filename" TEXT NOT NULL,
  "totalAmount" BIGINT NOT NULL,
  "totalFee" BIGINT NOT NULL,
  "totalGST" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DOWNLOADED',
  "errorMessage" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);

CREATE TABLE "PhonePeSettlementItem" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "settlementFileId" TEXT NOT NULL,
  "bookingId" TEXT,
  "featuredId" TEXT,
  "paymentId" TEXT NOT NULL,
  "amount" BIGINT NOT NULL,
  "fee" BIGINT NOT NULL,
  "gst" BIGINT NOT NULL,
  "paymentMethod" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("settlementFileId") REFERENCES "PhonePeSettlementFile" ("id"),
  FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id"),
  FOREIGN KEY ("featuredId") REFERENCES "Featured" ("id")
);

CREATE INDEX "PhonePeSettlementItem_settlementFileId" ON "PhonePeSettlementItem"("settlementFileId");
CREATE INDEX "PhonePeSettlementItem_bookingId" ON "PhonePeSettlementItem"("bookingId");
CREATE INDEX "PhonePeSettlementItem_paymentId" ON "PhonePeSettlementItem"("paymentId");
