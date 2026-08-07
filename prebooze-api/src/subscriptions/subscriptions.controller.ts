import { Body, Controller, Headers, Post, Req, UnauthorizedException } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { SubscriptionsService } from './subscriptions.service';
import { RazorpayService } from '../payments/razorpay.service';
import { FeaturedService } from '../featured/featured.service';

/** Razorpay's server-to-server callback for subscription lifecycle events —
 * see RAZORPAY.md. Public (no JWT — Razorpay isn't a logged-in user), but
 * every request is signature-verified against the raw body before anything
 * is trusted (see RazorpayService.verifyWebhookSignature). This is also the
 * first webhook endpoint this backend has ever had — the same infra closes
 * the previously-documented "no Razorpay webhook handler" gap for one-time
 * payments too, if extended to `payment.*`/`refund.*` events later.
 *
 * Two independent subscription types now share this one endpoint (role
 * plan tiers and Featured auto-renewal) — both handlers run on every
 * event and each looks the subscription id up in its own table, silently
 * no-op'ing when it's not theirs, so they never need to know about each
 * other. */
@Controller('webhooks')
export class RazorpayWebhookController {
  constructor(
    private subs: SubscriptionsService,
    private featured: FeaturedService,
    private razorpay: RazorpayService,
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
    }
    return { ok: true };
  }
}
