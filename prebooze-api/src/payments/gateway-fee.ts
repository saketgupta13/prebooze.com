export type PaymentMethod = 'UPI' | 'CARD' | 'NETBANKING' | 'WALLET' | 'EMI';
export type Gateway = 'RAZORPAY' | 'PHONEPE';

const RAZORPAY_FEE_PCT = 2.36;
const PHONEPE_BASE_FEE_PCT = 1.99; // Cards, NetBanking, BNPL, Wallets
const PHONEPE_UPI_FEE_PCT = 0;
const GST_PCT = 18;

export function getGatewayAndMethod(paymentId: string | null): { gateway: Gateway; method?: PaymentMethod } {
  if (paymentId?.startsWith('pay_')) {
    return { gateway: 'RAZORPAY' };
  }
  return { gateway: 'PHONEPE' };
}

export function getBaseFeePercent(gateway: Gateway, method?: PaymentMethod | string): number {
  if (gateway === 'RAZORPAY') {
    return RAZORPAY_FEE_PCT;
  }
  // PhonePe. Real bug fixed 2026-09-23: `Booking.paymentMethod` is stored
  // lowercase ('upi', from HoldsService.create) but this compared against
  // the uppercase 'UPI' literal, so every real UPI booking silently fell
  // through to the 1.99% card rate instead of PhonePe's real 0% UPI rate —
  // found via a refund whose computed deduction came back bigger than the
  // booking total. Case-insensitive now, and defensively so even if a
  // caller passes the raw DB string instead of the typed PaymentMethod.
  if (String(method).toUpperCase() === 'UPI') {
    return PHONEPE_UPI_FEE_PCT;
  }
  // All other methods (CARD, NETBANKING, WALLET, EMI, etc.): 1.99%
  return PHONEPE_BASE_FEE_PCT;
}

export function calculateGatewayFee(
  amount: number,
  gateway: Gateway,
  method?: PaymentMethod,
): { baseFee: number; gst: number; total: number } {
  const feePercent = getBaseFeePercent(gateway, method);
  const baseFee = Math.round(amount * (feePercent / 100));

  if (gateway === 'RAZORPAY') {
    // Razorpay's 2.36% already includes effective GST treatment
    return { baseFee, gst: 0, total: baseFee };
  }

  // PhonePe: add 18% GST on top of base fee
  const gst = Math.round(baseFee * (GST_PCT / 100));
  return { baseFee, gst, total: baseFee + gst };
}

export function getGatewayFeeLostOnRefund(booking: {
  total: number;
  paymentId: string | null;
  paymentMethod?: string | null;
}): { feeLost: number; gstLost: number } {
  const { gateway, method } = getGatewayAndMethod(booking.paymentId);
  // calculateGatewayFee is paise-in/paise-out (see settlements.service.ts's
  // own correct `/ 100` conversion after calling it) — this caller feeds it
  // `booking.total * 100` (paise) but used to return the paise result
  // straight into `booking.total - feeLost` (rupees) unconverted. Real bug
  // fixed 2026-09-23: found via a real refund whose computed deduction
  // (in paise, but treated as rupees) came back larger than the whole
  // booking total, clamping the "amount to refund" to ₹0.
  const { baseFee, gst } = calculateGatewayFee(booking.total * 100, gateway, (booking.paymentMethod || method) as PaymentMethod);
  return { feeLost: Math.round(baseFee / 100), gstLost: Math.round(gst / 100) };
}
