import { Injectable, Logger } from '@nestjs/common';
import { createHmac, randomBytes } from 'crypto';

/** Razorpay integration — same provider-agnostic dev-stub pattern as
 * WhatsappService/KycProviderService. With no RAZORPAY_KEY_ID/SECRET
 * configured, orders/payments/refunds are simulated instantly so the whole
 * booking flow is testable end-to-end without a live gateway. */
@Injectable()
export class RazorpayService {
  private readonly log = new Logger('Razorpay');

  get live(): boolean {
    return Boolean(process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET);
  }

  private authHeader() {
    const token = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64');
    return `Basic ${token}`;
  }

  /** Amounts are always integer paise (₹1 = 100 paise), per Razorpay convention. */
  async createOrder(amountPaise: number, receipt: string): Promise<{ orderId: string }> {
    if (!this.live) {
      const orderId = `order_dev_${randomBytes(8).toString('hex')}`;
      this.log.log(`[dev] order created ${orderId} for ₹${amountPaise / 100} (receipt ${receipt})`);
      return { orderId };
    }
    const res = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise, currency: 'INR', receipt }),
    });
    if (!res.ok) throw new Error(`Razorpay order create failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { orderId: data.id };
  }

  /** Verifies the checkout-returned signature: HMAC-SHA256(orderId|paymentId, key_secret). */
  verifyPaymentSignature(orderId: string, paymentId: string, signature: string): boolean {
    if (!this.live) return orderId.startsWith('order_dev_'); // dev orders always "verify"
    const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');
    return expected === signature;
  }

  async refund(paymentId: string, amountPaise: number): Promise<{ refundId: string }> {
    if (!this.live || paymentId.startsWith('pay_dev_')) {
      const refundId = `rfnd_dev_${randomBytes(8).toString('hex')}`;
      this.log.log(`[dev] refund created ${refundId} for payment ${paymentId}, ₹${amountPaise / 100}`);
      return { refundId };
    }
    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}/refund`, {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: amountPaise }),
    });
    if (!res.ok) throw new Error(`Razorpay refund failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { refundId: data.id };
  }

  /** Dev-only helper so we can exercise the full flow without a checkout widget. */
  devFakePaymentId(): string {
    return `pay_dev_${randomBytes(8).toString('hex')}`;
  }
}
