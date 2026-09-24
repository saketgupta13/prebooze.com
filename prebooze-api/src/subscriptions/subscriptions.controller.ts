import { Controller, Headers, Post, Req } from '@nestjs/common';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { PhonePeService } from '../payments/phonepe.service';
import { BookingsService } from '../bookings/bookings.service';
import { SettlementsService } from '../admin/settlements.service';

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
    private settlements: SettlementsService,
  ) {}

  @Post('phonepe')
  async handle(@Req() req: RawBodyRequest<Request>, @Headers('authorization') authorization: string) {
    const raw = req.rawBody?.toString('utf8') ?? '';

    // Settlement webhooks (enabled 2026-09-24) use a different envelope —
    // `event`, not `type` — and the SDK has no typed support for them at
    // all (see PhonePeService.validateSettlementCallback's doc comment).
    // Checked first, cheaply, off the raw body before touching the
    // order/refund-shaped parse below.
    if (raw.includes('"event"') && raw.includes('"settlement.')) {
      try {
        const settlement = this.phonepe.validateSettlementCallback(authorization ?? '', raw);
        if (settlement) {
          await this.settlements
            .upsertPhonePeSettlement({
              settlementId: settlement.settlementId,
              state: settlement.state,
              utr: settlement.utr,
              amountPaise: settlement.amount,
              merchantId: settlement.merchantId,
              lastAttemptErrorCode: settlement.lastAttemptErrorCode,
              lastAttemptErrorDescription: settlement.lastAttemptErrorDescription,
              lastUpdatedAt: settlement.lastUpdatedAt,
            })
            .catch(() => {});
          return { ok: true };
        }
      } catch {
        // Same lesson as below — an invalid/malformed settlement callback
        // must never 500 and block the webhook from being saved.
        return { ok: true };
      }
    }

    let callback: { type: string; merchantOrderId: string; originalMerchantOrderId: string; refundId: string; amount: number; state: string };
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
    // Real refund lifecycle — previously ignored entirely (every pg.refund.*
    // event fell through to the bare `{ ok: true }` below and did nothing),
    // the actual gap behind the 2026-09-23 "refund stuck on failed forever"
    // incident. Matched by `originalMerchantOrderId`, not `merchantOrderId`
    // — PhonePe's refund payloads key off the ORIGINAL payment's order id,
    // which is what's stored as Booking.paymentId.
    if (callback.type === 'PG_REFUND_COMPLETED' && callback.originalMerchantOrderId) {
      await this.bookings.reconcilePhonePeRefund(callback.originalMerchantOrderId, 'COMPLETED', callback.refundId || undefined, callback.amount).catch(() => {});
    }
    if (callback.type === 'PG_REFUND_FAILED' && callback.originalMerchantOrderId) {
      await this.bookings.reconcilePhonePeRefund(callback.originalMerchantOrderId, 'FAILED', callback.refundId || undefined, callback.amount).catch(() => {});
    }
    return { ok: true };
  }
}
