import { Body, Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { RazorpayService } from '../payments/razorpay.service';
import { PhonePeService } from '../payments/phonepe.service';
import { FeaturedService } from '../featured/featured.service';
import { MarketingService } from '../marketing/marketing.service';
import { BookingsService } from '../bookings/bookings.service';

/** Razorpay's server-to-server callback for subscription lifecycle events —
 * see RAZORPAY.md. Public (no JWT — Razorpay isn't a logged-in user), but
 * every request is signature-verified against the raw body before anything
 * is trusted (see RazorpayService.verifyWebhookSignature). This is also the
 * first webhook endpoint this backend has ever had — the same infra closes
 * the previously-documented "no Razorpay webhook handler" gap for one-time
 * payments too, if extended to `payment.*`/`refund.*` events later.
 *
 * Three independent handlers now share this one endpoint (role plan tiers,
 * Featured auto-renewal, and one-time booking payments) — all run on every
 * event and each either looks its own id up in its own table or matches
 * its own event type, silently no-op'ing when it's not theirs, so none of
 * them need to know about each other. */
@Controller('webhooks')
export class RazorpayWebhookController {
  constructor(
    private subs: SubscriptionsService,
    private featured: FeaturedService,
    private marketing: MarketingService,
    private razorpay: RazorpayService,
    private bookings: BookingsService,
  ) {}

  @Post('razorpay')
  async handle(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature: string, @Body() body: { event?: string; payload?: unknown } | undefined) {
    // Real bug found 2026-08-27: Razorpay's dashboard sends an empty
    // connectivity-check request before actually saving a new webhook —
    // both rawBody and body are then undefined/empty, and
    // JSON.stringify(undefined) returns the literal value undefined (not
    // a string), which crashed createHmac().update() with a 500. Razorpay's
    // dashboard surfaced that back as an opaque "json request could not be
    // decoded" error, blocking the webhook from ever being saved.
    const raw = req.rawBody?.toString('utf8') ?? (body ? JSON.stringify(body) : '');
    if (!this.razorpay.verifyWebhookSignature(raw, signature ?? '')) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    if (body?.event) {
      await this.subs.handleWebhookEvent(body.event, body.payload);
      await this.featured.handleWebhookEvent(body.event, body.payload);
      await this.marketing.handleWebhookEvent(body.event, body.payload);
      // Closes the "no Razorpay webhook handler for one-time payments" gap
      // this file's own doc comment used to flag — see the 2026-08-27
      // incident (payment captured, booking never created because the
      // guest's browser tab died mid-UPI-app-switch) that made this urgent.
      if (body.event === 'payment.captured') {
        const payment = (body.payload as { payment?: { entity?: { id?: string; order_id?: string; amount?: number } } })?.payment?.entity;
        if (payment?.id && payment.order_id && payment.amount) {
          await this.bookings.reconcilePayment(payment.id, payment.order_id, payment.amount).catch(() => {});
        }
      }
    }
    return { ok: true };
  }
}

/** PhonePe's server-to-server callback for order/refund lifecycle events —
 * closes the gap where a real payment completes but the guest's own
 * browser never makes it back to /checkout?phonepe_return=1 to finish
 * create() (tab killed mid-payment, app backgrounded and never resumed,
 * etc.) — the same class of incident that motivated the Razorpay webhook
 * above, now closed for PhonePe too. Public (no JWT — PhonePe isn't a
 * logged-in user), authenticated instead via the merchant-configured
 * username/password hashed into the `authorization` header
 * (PhonePeService.validateCallback) — every request must pass that before
 * anything in the body is trusted. */
@Controller('webhooks')
export class PhonePeWebhookController {
  constructor(
    private phonepe: PhonePeService,
    private bookings: BookingsService,
  ) {}

  @Post('phonepe')
  async handle(@Req() req: RawBodyRequest<Request>, @Headers('authorization') authorization: string) {
    const raw = req.rawBody?.toString('utf8') ?? '';
    let callback: { type: string; merchantOrderId: string; amount: number; state: string };
    try {
      callback = this.phonepe.validateCallback(authorization ?? '', raw);
    } catch {
      // Same lesson as the Razorpay webhook's dashboard connectivity-check
      // bug (2026-08-27) — an empty/malformed validation ping PhonePe's own
      // dashboard sends while saving this webhook must never 500 and block
      // it from ever being saved.
      return { ok: true };
    }
    if (callback.type === 'CHECKOUT_ORDER_COMPLETED' && callback.state === 'COMPLETED' && callback.merchantOrderId) {
      await this.bookings.reconcilePhonePePayment(callback.merchantOrderId, callback.amount).catch(() => {});
    }
    return { ok: true };
  }
}
