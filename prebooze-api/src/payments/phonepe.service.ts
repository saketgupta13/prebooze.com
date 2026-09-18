import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { StandardCheckoutClient, StandardCheckoutPayRequest, RefundRequest, Env } from '@phonepe-pg/pg-sdk-node';

/** PhonePe Payment Gateway integration (2026-09-18) — replacing the
 * temporary/borrowed Razorpay account with Prebooze's own real merchant
 * account. Same provider-agnostic dev-stub pattern as RazorpayService/
 * WhatsappService/KycProviderService: with no PHONEPE_CLIENT_ID/SECRET
 * configured, orders/refunds are simulated instantly so the booking flow
 * stays testable end-to-end without hitting the live gateway.
 *
 * Real, structural differences from Razorpay this service's callers need to
 * know about — this is NOT a drop-in replacement:
 * 1. WE generate the order identifier (`merchantOrderId`), not the gateway —
 *    Razorpay's `createOrder` hands back its own `orderId`; here the caller
 *    must pass one in (reuse the existing hold/cart id, same value
 *    Razorpay's `receipt` param already used).
 * 2. The checkout flow is a real browser REDIRECT to PhonePe's own hosted
 *    page (`createOrder`'s `redirectUrl` return value), not an embedded
 *    Checkout.js modal — confirmed against the official SDK source, not
 *    assumed. PhonePe redirects the guest back to our `redirectUrl` after,
 *    but that return trip is NOT the source of truth for payment success.
 * 3. There is no client-reported signature to verify (Razorpay's
 *    `verifyPaymentSignature`). The only trustworthy confirmation is our
 *    own server calling `getOrderStatus(merchantOrderId)` (or, later, a
 *    verified webhook) — `state` comes back as one of PENDING/COMPLETED/
 *    FAILED. Never trust anything the browser reports on redirect-back.
 * 4. Refunds are keyed by OUR OWN `originalMerchantOrderId`, not a separate
 *    gateway payment id — simpler than Razorpay here, nothing extra to
 *    store.
 * Verified for real against the live production account 2026-09-18: a real
 * ₹1 order (`createOrder`) and its `getOrderStatus` both round-tripped
 * successfully against `https://api.phonepe.com` (after a short propagation
 * delay right after the credentials were generated — retrying after ~5 min
 * fixed a first-attempt 401 `AUTHORIZATION_FAILED`, not a credential error). */
@Injectable()
export class PhonePeService {
  private readonly log = new Logger('PhonePe');
  private client: StandardCheckoutClient | null = null;

  get live(): boolean {
    return Boolean(process.env.PHONEPE_CLIENT_ID && process.env.PHONEPE_CLIENT_SECRET);
  }

  /** Lazily created, not at module construction — avoids the SDK's
   * singleton `getInstance` throwing at app boot in dev when no real
   * credentials are configured. */
  private getClient(): StandardCheckoutClient {
    if (!this.client) {
      const env = process.env.PHONEPE_ENV === 'SANDBOX' ? Env.SANDBOX : Env.PRODUCTION;
      this.client = StandardCheckoutClient.getInstance(
        process.env.PHONEPE_CLIENT_ID!,
        process.env.PHONEPE_CLIENT_SECRET!,
        parseInt(process.env.PHONEPE_CLIENT_VERSION ?? '1', 10),
        env,
        false, // shouldPublishEvents — the SDK's own internal telemetry call, unrelated to real payment processing, left off
      );
    }
    return this.client;
  }

  /** Amounts are always integer paise (₹1 = 100 paise) — confirmed against
   * a real production order (input 100 → reported back as 100, no
   * scaling), same convention as Razorpay. `merchantOrderId` is caller-
   * supplied (reuse the existing hold/cart id) since PhonePe doesn't
   * generate one for us. */
  async createOrder(merchantOrderId: string, amountPaise: number, redirectUrl: string): Promise<{ orderId: string; redirectUrl: string; state: string }> {
    if (!this.live) {
      const orderId = `phonepe_dev_${randomBytes(8).toString('hex')}`;
      this.log.log(`[dev] order created ${orderId} (merchantOrderId ${merchantOrderId}) for ₹${amountPaise / 100}`);
      return { orderId, redirectUrl: `${redirectUrl}?dev=1&merchantOrderId=${merchantOrderId}`, state: 'PENDING' };
    }
    const request = StandardCheckoutPayRequest.builder()
      .merchantOrderId(merchantOrderId)
      .amount(amountPaise)
      .redirectUrl(redirectUrl)
      .build();
    const res = await this.getClient().pay(request);
    return { orderId: res.orderId, redirectUrl: res.redirectUrl, state: res.state };
  }

  /** The one real source of truth for "did this actually get paid" — never
   * trust the browser's redirect-back alone. `state` is one of PENDING /
   * COMPLETED / FAILED (PhonePe's own vocabulary, confirmed against a real
   * PENDING order). */
  async getOrderStatus(merchantOrderId: string): Promise<{ state: string; amount: number; orderId: string } | null> {
    if (!this.live || merchantOrderId.startsWith('phonepe_dev_')) {
      return { state: 'COMPLETED', amount: 0, orderId: `phonepe_dev_${merchantOrderId}` };
    }
    try {
      const res = await this.getClient().getOrderStatus(merchantOrderId);
      return { state: res.state, amount: res.amount, orderId: res.orderId };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'ORDER_NOT_FOUND') return null;
      throw err;
    }
  }

  /** Keyed by our own `originalMerchantOrderId` (the id `createOrder` was
   * given) — no separate gateway payment id to track, unlike Razorpay's
   * `refund(paymentId, ...)`. `merchantRefundId` is our own new id for
   * this specific refund attempt (a booking cancelled twice would need two
   * distinct refund ids even against the same original order). */
  async refund(merchantRefundId: string, originalMerchantOrderId: string, amountPaise: number): Promise<{ refundId: string; state: string }> {
    if (!this.live || originalMerchantOrderId.startsWith('phonepe_dev_')) {
      const refundId = `phonepe_rfnd_dev_${randomBytes(8).toString('hex')}`;
      this.log.log(`[dev] refund created ${refundId} for order ${originalMerchantOrderId}, ₹${amountPaise / 100}`);
      return { refundId, state: 'COMPLETED' };
    }
    const request = RefundRequest.builder()
      .merchantRefundId(merchantRefundId)
      .originalMerchantOrderId(originalMerchantOrderId)
      .amount(amountPaise)
      .build();
    const res = await this.getClient().refund(request);
    return { refundId: res.refundId, state: res.state };
  }

  async getRefundStatus(refundId: string): Promise<{ state: string; amount: number } | null> {
    if (!this.live || refundId.startsWith('phonepe_rfnd_dev_')) return { state: 'COMPLETED', amount: 0 };
    try {
      const res = await this.getClient().getRefundStatus(refundId);
      return { state: res.state, amount: res.amount };
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code === 'REFUND_NOT_FOUND' || code === 'ORDER_NOT_FOUND') return null;
      throw err;
    }
  }

  /** PhonePe equivalent of RazorpayService.getPayment — used right after a
   * successful checkout to auto-save the method actually used. Only ever
   * returns something for UPI payments (paymentMode UPI_COLLECT/INTENT/QR),
   * where `rail.vpa` is a real, reusable identifier — confirmed against the
   * real SDK's `UpiPaymentRail` model. Card/netbanking payment details
   * (`CreditCardPaymentInstrumentV2` etc.) don't expose a maskable last4/
   * network the way Razorpay's payment object did, so those are left
   * unsaved rather than guessed at — `saveUsedMethod`'s caller already
   * treats `undefined` as "nothing to save," same as any other method it
   * doesn't recognize. */
  async getPaymentMethod(merchantOrderId: string): Promise<{ method: string; vpa?: string } | undefined> {
    if (!this.live || merchantOrderId.startsWith('phonepe_dev_')) return { method: 'upi', vpa: 'dev@upi' };
    try {
      const res = await this.getClient().getOrderStatus(merchantOrderId, true);
      const latest = res.paymentDetails?.[res.paymentDetails.length - 1];
      const rail = latest?.rail as { vpa?: string } | undefined;
      if (rail?.vpa) return { method: 'upi', vpa: rail.vpa };
      return undefined;
    } catch {
      return undefined;
    }
  }

  /** Dev-only helper mirroring RazorpayService.devFakePaymentId — lets the
   * booking flow be exercised locally without a real gateway. */
  devFakeMerchantOrderId(): string {
    return `phonepe_dev_${randomBytes(8).toString('hex')}`;
  }

  /** S2S callback authenticity check — PhonePe uses a merchant-configured
   * username/password (set on the dashboard's Developer Settings → Webhook
   * tab, NOT the same as clientId/clientSecret), hashed into the
   * `authorization` header. Throws on an invalid callback; caller must
   * never process a callback body without this passing first.
   * `merchantOrderId` is the id OUR OWN quote() minted (never holdId
   * directly — see quote()'s doc comment) and is what
   * BookingsService.reconcilePhonePePayment looks a Cart up by; `type`
   * distinguishes an actual completion from a failure/refund event, per
   * the SDK's real CallbackType enum. */
  validateCallback(authorizationHeader: string, rawBody: string): { type: string; merchantOrderId: string; amount: number; state: string } {
    if (!this.live) return { type: 'CHECKOUT_ORDER_COMPLETED', merchantOrderId: 'dev', amount: 0, state: 'COMPLETED' };
    const username = process.env.PHONEPE_WEBHOOK_USERNAME;
    const password = process.env.PHONEPE_WEBHOOK_PASSWORD;
    if (!username || !password) throw new Error('PHONEPE_WEBHOOK_USERNAME/PASSWORD not configured — cannot validate a real callback');
    const parsed = this.getClient().validateCallback(username, password, authorizationHeader, rawBody);
    return {
      type: String(parsed.type),
      merchantOrderId: parsed.payload.merchantOrderId ?? '',
      amount: parsed.payload.amount,
      state: parsed.payload.state,
    };
  }
}
