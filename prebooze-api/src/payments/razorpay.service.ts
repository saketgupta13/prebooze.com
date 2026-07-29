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

  /** Fetch a completed payment's real method details — used right after a
   * successful checkout to auto-save the payment method that was actually
   * used, matching what Checkout's own "Pay with" list already showed
   * (real Razorpay-issued last4/network, never anything typed/guessed
   * client-side). Dev mode returns a stable fake card so the auto-save +
   * dedupe path is still exercisable without a live gateway. */
  async getPayment(paymentId: string): Promise<{
    method: string;
    card?: { last4: string; network: string; type: string };
    vpa?: string;
  }> {
    if (!this.live || paymentId.startsWith('pay_dev_')) {
      return { method: 'card', card: { last4: '4242', network: 'Visa', type: 'credit' } };
    }
    const res = await fetch(`https://api.razorpay.com/v1/payments/${paymentId}`, {
      headers: { Authorization: this.authHeader() },
    });
    if (!res.ok) throw new Error(`Razorpay payment fetch failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return {
      method: data.method,
      card: data.card ? { last4: data.card.last4, network: data.card.network, type: data.card.type } : undefined,
      vpa: data.vpa ?? undefined,
    };
  }

  // ---------- Subscriptions (organizer/promoter/venue plan billing) ----------
  // Same dev-stub pattern as everything above. Docs: razorpay.com/docs/api/payments/subscriptions/

  /** A Razorpay Plan is the recurring price itself (period + interval +
   * amount) — created once per SubTier, lazily, the first time anyone
   * actually tries to pay for it (not at seed time), then its id is cached
   * on `SubTier.razorpayPlanId` so we never create a duplicate plan for the
   * same tier. */
  async createPlan(name: string, amountPaise: number, description: string): Promise<{ planId: string }> {
    if (!this.live) {
      const planId = `plan_dev_${randomBytes(8).toString('hex')}`;
      this.log.log(`[dev] plan created ${planId} "${name}" — ₹${amountPaise / 100}/month`);
      return { planId };
    }
    const res = await fetch('https://api.razorpay.com/v1/plans', {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({
        period: 'monthly',
        interval: 1,
        item: { name, amount: amountPaise, currency: 'INR', description },
      }),
    });
    if (!res.ok) throw new Error(`Razorpay plan create failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { planId: data.id };
  }

  /** Creates the Subscription itself — still `status: "created"` until the
   * owner actually authorizes it (via `short_url` or Checkout in
   * subscription mode). `total_count: 120` = bill monthly for 10 years,
   * Razorpay's own recommended stand-in for "no end date" (the API has no
   * literal "forever" option). `customer_notify: true` lets Razorpay send
   * its own receipt/reminder emails on top of ours. */
  async createSubscription(planId: string, notes: Record<string, string>): Promise<{ subscriptionId: string; shortUrl: string | null; status: string }> {
    if (!this.live) {
      const subscriptionId = `sub_dev_${randomBytes(8).toString('hex')}`;
      this.log.log(`[dev] subscription created ${subscriptionId} for plan ${planId} (${JSON.stringify(notes)})`);
      return { subscriptionId, shortUrl: null, status: 'created' };
    }
    const res = await fetch('https://api.razorpay.com/v1/subscriptions', {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ plan_id: planId, total_count: 120, customer_notify: true, notes }),
    });
    if (!res.ok) throw new Error(`Razorpay subscription create failed: ${res.status} ${await res.text()}`);
    const data = await res.json();
    return { subscriptionId: data.id, shortUrl: data.short_url ?? null, status: data.status };
  }

  async cancelSubscription(subscriptionId: string, cancelAtCycleEnd: boolean): Promise<void> {
    if (!this.live || subscriptionId.startsWith('sub_dev_')) {
      this.log.log(`[dev] subscription ${subscriptionId} cancelled (at cycle end: ${cancelAtCycleEnd})`);
      return;
    }
    const res = await fetch(`https://api.razorpay.com/v1/subscriptions/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: { Authorization: this.authHeader(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ cancel_at_cycle_end: cancelAtCycleEnd ? 1 : 0 }),
    });
    if (!res.ok) throw new Error(`Razorpay subscription cancel failed: ${res.status} ${await res.text()}`);
  }

  /** Verifies the triplet Checkout hands back after subscription authorization:
   * HMAC-SHA256(paymentId|subscriptionId, key_secret) — same shape as
   * verifyPaymentSignature but subscription-flavored per Razorpay's docs. */
  verifySubscriptionSignature(paymentId: string, subscriptionId: string, signature: string): boolean {
    if (!this.live) return subscriptionId.startsWith('sub_dev_');
    const expected = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET!)
      .update(`${paymentId}|${subscriptionId}`)
      .digest('hex');
    return expected === signature;
  }

  /** Webhook signature uses a DIFFERENT secret than the API key/secret pair
   * (the "webhook secret" set when configuring the webhook URL in the
   * Razorpay dashboard) — HMAC-SHA256 over the exact raw request body. Dev
   * mode (no RAZORPAY_KEY_ID/SECRET) trusts any payload unconditionally, same
   * as every other dev-stub here — there's no live account to spoof against,
   * so this is what lets `POST /webhooks/razorpay` be exercised locally with
   * a hand-crafted test event. Once the main keys are live, a missing/wrong
   * RAZORPAY_WEBHOOK_SECRET hard-fails — a real, unverifiable webhook must
   * never be trusted. */
  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!this.live) return true;
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) return false;
    const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
    return expected === signature;
  }
}
