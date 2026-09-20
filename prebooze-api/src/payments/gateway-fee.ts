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

export function getBaseFeePercent(gateway: Gateway, method?: PaymentMethod): number {
  if (gateway === 'RAZORPAY') {
    return RAZORPAY_FEE_PCT;
  }
  // PhonePe
  if (method === 'UPI') {
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
  const { baseFee, gst } = calculateGatewayFee(booking.total * 100, gateway, (booking.paymentMethod || method) as PaymentMethod);
  return { feeLost: baseFee, gstLost: gst };
}
