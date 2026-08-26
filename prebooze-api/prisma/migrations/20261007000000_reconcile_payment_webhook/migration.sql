-- Cart.bookingPayload: snapshot of the guest's attendee-details/coupon/
-- wallet/promoter/payMethod choices, taken the instant they click Pay —
-- lets the Razorpay webhook fallback finish a booking whose client-side
-- confirmation never arrived. Nullable, defaults to nothing for every
-- existing cart.
ALTER TABLE "Cart" ADD COLUMN "bookingPayload" JSONB;

-- Booking.paymentId unique: the hard backstop against a real double-booking
-- when the client's own post-payment call and the webhook reconciliation
-- fallback race for the same payment. Confirmed no existing duplicates
-- before adding this constraint.
CREATE UNIQUE INDEX "Booking_paymentId_key" ON "Booking"("paymentId");
