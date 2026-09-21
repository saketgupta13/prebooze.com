-- Create PhonePe settlement tables
CREATE TABLE "PhonePeSettlementFile" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "fileDate" TIMESTAMP NOT NULL,
  "downloadedAt" TIMESTAMP NOT NULL,
  "filename" TEXT NOT NULL,
  "totalAmount" BIGINT NOT NULL,
  "totalFee" BIGINT NOT NULL,
  "totalGST" BIGINT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'DOWNLOADED',
  "errorMessage" TEXT,
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP NOT NULL
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
  "createdAt" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY ("settlementFileId") REFERENCES "PhonePeSettlementFile" ("id"),
  FOREIGN KEY ("bookingId") REFERENCES "Booking" ("id"),
  FOREIGN KEY ("featuredId") REFERENCES "Featured" ("id")
);

CREATE INDEX "PhonePeSettlementItem_settlementFileId" ON "PhonePeSettlementItem"("settlementFileId");
CREATE INDEX "PhonePeSettlementItem_bookingId" ON "PhonePeSettlementItem"("bookingId");
CREATE INDEX "PhonePeSettlementItem_paymentId" ON "PhonePeSettlementItem"("paymentId");
