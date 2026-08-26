import { Body, Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { RazorpayService } from '../payments/razorpay.service';
import { FeaturedService } from '../featured/featured.service';
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
    private razorpay: RazorpayService,
    private bookings: BookingsService,
  ) {}

  @Post('razorpay')
  async handle(@Req() req: RawBodyRequest<Request>, @Headers('x-razorpay-signature') signature: string, @Body() body: { event?: string; payload?: unknown }) {
    const raw = req.rawBody?.toString('utf8') ?? JSON.stringify(body);
    if (!this.razorpay.verifyWebhookSignature(raw, signature ?? '')) {
      throw new UnauthorizedException('Invalid webhook signature');
    }
    if (body.event) {
      await this.subs.handleWebhookEvent(body.event, body.payload);
      await this.featured.handleWebhookEvent(body.event, body.payload);
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
