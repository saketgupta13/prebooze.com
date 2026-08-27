CREATE TABLE "RazorpaySettlementItem" (
  "id" TEXT NOT NULL,
  "settlementId" TEXT NOT NULL,
  "amount" INTEGER NOT NULL,
  "fee" INTEGER NOT NULL,
  "tax" INTEGER NOT NULL,
  "paidAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "RazorpaySettlementItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "RazorpaySettlementItem_settlementId_idx" ON "RazorpaySettlementItem"("settlementId");
