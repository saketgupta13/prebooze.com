import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { money } from '../notifications/email-templates';
import { InvoicesService } from '../invoices/invoices.service';
import { RazorpayService } from '../payments/razorpay.service';
import { WalletService } from '../wallet/wallet.service';
import { StaffAlertsService } from '../notifications/staff-alerts';

interface RazorpaySubEntity {
  id: string;
  current_start?: number | null;
  current_end?: number | null;
}

/** Mirrors prebooze-web's FEATURED_PRICING (src/data/mock.ts), including
 * venueMonthly (the frontend contract, src/api/index.ts featured.rates(),
 * already includes it too). Used only as the seed default now — real rates
 * live on PlatformSettings, admin-editable (Admin API "featured rates"
 * slice — this was flagged in this file's own comment as "separate Admin
 * API work" and left a hardcoded constant until now). */
const FALLBACK_RATES = { perEvent: 2000, organizerMonthly: 4999, promoterMonthly: 2999, lineupMonthly: 1999, venueMonthly: 3999 };

type FeaturedType = 'event' | 'organizer' | 'promoter' | 'lineup' | 'venue';

function monthFromNow(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

@Injectable()
export class FeaturedService {
  constructor(
    private prisma: PrismaService,
    private wa: WhatsappService,
    private email: EmailService,
    private invoices: InvoicesService,
    private razorpay: RazorpayService,
    private wallet: WalletService,
    private staffAlerts: StaffAlertsService,
  ) {}

  /** Resolves ownership + the server-trusted city/expiry for a request —
   * never the client's. Throws ForbiddenException if the caller doesn't
   * actually own refId. */
  private async resolveTarget(userId: string, type: FeaturedType, refId: string): Promise<{ city: string; expiresAt: Date }> {
    switch (type) {
      case 'event': {
        const org = await this.prisma.organizer.findUnique({ where: { userId } });
        const event = await this.prisma.event.findUnique({ where: { id: refId }, include: { venue: true } });
        if (!org || !event || event.organizerId !== org.id) throw new ForbiddenException();
        const city = event.venue?.city ?? event.privateCity;
        if (!city) throw new ForbiddenException();
        return { city, expiresAt: event.date };
      }
      case 'organizer': {
        const org = await this.prisma.organizer.findUnique({ where: { userId } });
        if (!org || org.id !== refId) throw new ForbiddenException();
        return { city: org.city, expiresAt: monthFromNow() };
      }
      case 'promoter': {
        const p = await this.prisma.promoter.findUnique({ where: { userId } });
        if (!p || p.slug !== refId) throw new ForbiddenException();
        return { city: p.city, expiresAt: monthFromNow() };
      }
      case 'lineup': {
        const l = await this.prisma.lineup.findUnique({ where: { userId } });
        if (!l || l.slug !== refId) throw new ForbiddenException();
        return { city: l.city, expiresAt: monthFromNow() };
      }
      case 'venue': {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user?.venueId || user.venueId !== refId) throw new ForbiddenException();
        const venue = await this.prisma.venue.findUnique({ where: { id: refId } });
        if (!venue) throw new NotFoundException();
        return { city: venue.city, expiresAt: monthFromNow() };
      }
      default:
        throw new BadRequestException('Unknown featured type');
    }
  }

  /** Creates the request AND a real Razorpay order for the amount owed —
   * the request stays `paid: false` until `confirmPayment` verifies a real
   * checkout signature; `adminApprove` refuses to approve an unpaid one.
   * No Invoice is created here — an invoice is a billing document that
   * claims money changed hands, and at this point it hasn't. It used to be
   * created unconditionally right here, so cancelling the Razorpay checkout
   * still left behind a real, "issued" invoice for a payment that never
   * happened. It's created in confirmPayment now, only once the signature
   * actually verifies. gstPct/gstAmount/total are persisted on the row so
   * that later invoice reflects exactly what this order charged, even if
   * admin changes the platform GST% before the guest finishes paying. */
  async request(userId: string, input: { type: FeaturedType; refId: string; billing: 'per_event' | 'monthly' }) {
    if (!input.type || !input.refId) throw new BadRequestException('type and refId are required');
    if (input.type === 'event' && input.billing !== 'per_event') throw new BadRequestException('Events are featured per-event, not monthly');
    if (input.type !== 'event' && input.billing !== 'monthly') throw new BadRequestException(`${input.type} can only be featured monthly`);

    const { city, expiresAt } = await this.resolveTarget(userId, input.type, input.refId);
    const rates = await this.rates();
    const amount = input.billing === 'per_event' ? rates.perEvent : rates[`${input.type}Monthly` as keyof typeof rates];

    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    const gstPct = settings?.gstPct ?? 0;
    const gstAmount = Math.round((amount * gstPct) / 100);
    const total = amount + gstAmount;

    // matches the mock's requestFeatured: a fresh request replaces whatever
    // pending/active/expired record already existed for this exact item
    await this.prisma.featured.deleteMany({ where: { type: input.type as never, refId: input.refId } });
    let row = await this.prisma.featured.create({
      data: { type: input.type as never, refId: input.refId, city, billing: input.billing as never, amount, expiresAt, gstPct, gstAmount, total },
    });

    const { orderId } = await this.razorpay.createOrder(total * 100, row.id);
    row = await this.prisma.featured.update({ where: { id: row.id }, data: { razorpayOrderId: orderId } });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const itemLabel = `${input.type} (${input.refId})`;
      await this.wa.send(user.phone, 'featured_submitted', [String(amount), itemLabel]).catch(() => {});
      await this.email.sendTemplate(user.email, 'featured_submitted', {
        name: user.name, amount: money(amount), itemLabel,
      }).catch(() => {});
    }

    return { ...row, razorpayOrder: { orderId, amount: total * 100, keyId: process.env.RAZORPAY_KEY_ID || undefined } };
  }

  /** Verifies the checkout-returned signature against the order created in
   * `request()` and marks the placement payable-for-review. Re-checks
   * ownership the same way `request()` did — Featured has no userId column
   * (refId + type is the only link back to an owner), so this is the only
   * way to confirm the caller confirming payment is the same one who made
   * the request. The real Invoice is created here, once, only on the branch
   * where the signature actually verifies. */
  async confirmPayment(userId: string, id: string, proof: { paymentId: string; signature: string }) {
    const row = await this.prisma.featured.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Featured request not found');
    await this.resolveTarget(userId, row.type as FeaturedType, row.refId); // throws if not the owner
    if (!row.razorpayOrderId) throw new BadRequestException('This request has no payment to confirm');
    if (row.paid) return row;

    const valid = this.razorpay.verifyPaymentSignature(row.razorpayOrderId, proof.paymentId, proof.signature);
    if (!valid) throw new BadRequestException('Payment verification failed');

    const updated = await this.prisma.featured.update({ where: { id }, data: { paid: true, paymentId: proof.paymentId } });

    // Auto-save the method this real payment actually used — same
    // WalletService.saveUsedMethod dedup-by-matchKey path a guest checkout
    // uses; Featured payments already carry the caller's own real userId.
    await this.razorpay.getPayment(proof.paymentId).then((p) => this.wallet.saveUsedMethod(userId, p)).catch(() => {});

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const itemLabel = `${row.type} (${row.refId})`;
      const business = await this.resolveBillingIdentity(row.type as FeaturedType, row.refId);
      await this.invoices.create({
        type: 'featured', refId: row.id, role: row.type === 'event' ? 'organizer' : (row.type as never),
        payerName: user.name, payerEmail: user.email, payerPhone: user.phone, city: row.city,
        payerBrand: business?.brand, payerGstin: business?.gstin, payerPan: business?.pan,
        description: `Featured placement — ${itemLabel}`,
        subtotal: row.amount, gstPct: row.gstPct ?? 0, gstAmount: row.gstAmount ?? 0, total: row.total ?? row.amount,
      }).catch(() => {});
    }

    return updated;
  }

  /** Real business identity for the invoice's "bill to" — an organizer's
   * brand plus GSTIN/PAN off their default PaymentProfile (GSTIN/PAN no
   * longer live on Organizer itself — see PaymentProfile), distinct from the
   * individual account holder's name. Venue/promoter/lineup have no
   * GSTIN/PAN modeled, just a brand name. An organizer with no payment
   * profile yet just bills under their brand name with no GSTIN/PAN line —
   * Featured billing was never gated on having one. */
  private async resolveBillingIdentity(type: FeaturedType, refId: string): Promise<{ brand: string; gstin?: string | null; pan?: string | null } | null> {
    const organizerBilling = async (org: { id: string; brandName: string }) => {
      const profile = await this.prisma.paymentProfile.findFirst({ where: { organizerId: org.id, isDefault: true } });
      return { brand: org.brandName, gstin: profile?.gstin, pan: profile?.pan };
    };
    if (type === 'organizer') {
      const org = await this.prisma.organizer.findUnique({ where: { id: refId } });
      return org ? organizerBilling(org) : null;
    }
    if (type === 'event') {
      const event = await this.prisma.event.findUnique({ where: { id: refId }, include: { organizer: true, venue: true } });
      if (!event) return null;
      // Solo venue-hosted event (Event.hostedByVenue, no collaborating
      // organizer) — bill the venue instead. Venue has no GSTIN/PAN
      // modeled (same as promoter/lineup below), just a brand name.
      if (event.organizer) return organizerBilling(event.organizer);
      return event.venue ? { brand: event.venue.name } : null;
    }
    if (type === 'venue') {
      const venue = await this.prisma.venue.findUnique({ where: { id: refId } });
      return venue ? { brand: venue.name } : null;
    }
    if (type === 'promoter') {
      const p = await this.prisma.promoter.findFirst({ where: { OR: [{ id: refId }, { slug: refId }] } });
      return p ? { brand: p.name } : null;
    }
    const l = await this.prisma.lineup.findFirst({ where: { OR: [{ id: refId }, { slug: refId }] } });
    return l ? { brand: l.name } : null;
  }

  /** The caller's own current Featured row for this exact item, if any —
   * lets the frontend show real status (pending/active/expiresAt) instead
   * of a local guess. Reuses resolveTarget purely for its ownership check.
   * Ordered newest-first: an auto-renewing subscription accumulates one
   * immutable row per billed period (see startPeriod), so "the current one"
   * is always whichever was created most recently. */
  async mine(userId: string, type: FeaturedType, refId: string) {
    await this.resolveTarget(userId, type, refId);
    return this.prisma.featured.findFirst({ where: { type: type as never, refId }, orderBy: { createdAt: 'desc' } });
  }

  // ---------- auto-renewing subscription (organizer/promoter/lineup/venue only — never 'event') ----------

  /** Starts (or restarts, if a previous one lapsed/was cancelled) a real
   * Razorpay Subscription for this placement — same e-mandate rails as
   * SubscriptionsService.subscribe(), just billing a Featured placement
   * instead of a role's plan tier. The rate is locked in right now and
   * reused for every future renewal (see FeaturedSubscription doc comment);
   * nothing here goes live until the `subscription.activated` webhook
   * confirms the owner actually authorized it. */
  async subscribe(userId: string, input: { type: FeaturedType; refId: string }) {
    if (input.type === 'event') throw new BadRequestException('Events are featured per-event, not by subscription');
    const { city } = await this.resolveTarget(userId, input.type, input.refId);
    const rates = await this.rates();
    const amount = rates[`${input.type}Monthly` as keyof typeof rates];

    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    const gstPct = settings?.gstPct ?? 0;
    const gstAmount = Math.round((amount * gstPct) / 100);
    const total = amount + gstAmount;

    const typeLabel = input.type[0].toUpperCase() + input.type.slice(1);
    const { planId } = await this.razorpay.createPlan(`Featured — ${typeLabel}`, total * 100, `Prebooze Featured placement (${input.type}, auto-renews monthly)`);
    const sub = await this.razorpay.createSubscription(planId, { type: input.type, refId: input.refId });

    const row = await this.prisma.featuredSubscription.upsert({
      where: { type_refId: { type: input.type as never, refId: input.refId } },
      create: {
        type: input.type as never, refId: input.refId, city, amount, gstPct, gstAmount, total,
        razorpaySubId: sub.subscriptionId, status: 'created', shortUrl: sub.shortUrl,
      },
      update: {
        city, amount, gstPct, gstAmount, total, razorpaySubId: sub.subscriptionId,
        status: 'created', shortUrl: sub.shortUrl, currentStart: null, currentEnd: null, paidCount: 0,
      },
    });

    return {
      ok: true,
      requiresAuthorization: true,
      id: row.id,
      subscriptionId: sub.subscriptionId,
      shortUrl: sub.shortUrl,
      keyId: process.env.RAZORPAY_KEY_ID || undefined,
    };
  }

  /** Cancels at the end of the current billing cycle — same reasoning as
   * SubscriptionsService.cancel(): the owner keeps the placement live
   * through what they already paid for, then it stops (no new period gets
   * created once `subscription.cancelled` actually fires). */
  async cancelSubscription(userId: string, type: FeaturedType, refId: string) {
    await this.resolveTarget(userId, type, refId);
    const sub = await this.prisma.featuredSubscription.findUnique({ where: { type_refId: { type: type as never, refId } } });
    if (!sub || sub.status === 'cancelled') throw new BadRequestException('No active auto-renewing subscription to cancel');
    if (sub.razorpaySubId) await this.razorpay.cancelSubscription(sub.razorpaySubId, true);
    await this.prisma.featuredSubscription.update({ where: { id: sub.id }, data: { status: 'cancelled' } });
    return { ok: true };
  }

  async mySubscription(userId: string, type: FeaturedType, refId: string) {
    await this.resolveTarget(userId, type, refId);
    return this.prisma.featuredSubscription.findUnique({ where: { type_refId: { type: type as never, refId } } });
  }

  /** Dispatches a verified Razorpay webhook event for a Featured
   * subscription — identical shape to SubscriptionsService.handleWebhookEvent,
   * just keyed against FeaturedSubscription.razorpaySubId instead of
   * RoleSubscription's. Both handlers run on every webhook call (see
   * RazorpayWebhookController); each silently no-ops when the subscription
   * id isn't theirs, so they never need to coordinate. */
  async handleWebhookEvent(event: string, payload: unknown) {
    const subEntity = (payload as { subscription?: { entity?: RazorpaySubEntity } })?.subscription?.entity;
    if (!subEntity?.id) return;

    const record = await this.prisma.featuredSubscription.findUnique({ where: { razorpaySubId: subEntity.id } });
    if (!record) return; // not ours

    const type = record.type as FeaturedType;
    const currentStart = subEntity.current_start ? new Date(subEntity.current_start * 1000) : undefined;
    const currentEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000) : undefined;

    switch (event) {
      case 'subscription.authenticated':
        await this.prisma.featuredSubscription.update({ where: { id: record.id }, data: { status: 'authenticated' } });
        break;

      case 'subscription.activated': {
        const updated = await this.prisma.featuredSubscription.update({
          where: { id: record.id },
          data: { status: 'active', currentStart: currentStart ?? new Date(), currentEnd, shortUrl: null },
        });
        await this.startPeriod(updated, currentEnd);
        await this.notifyOwner(type, record.refId, 'featured_activated');
        break;
      }

      case 'subscription.charged': {
        const payment = (payload as { payment?: { entity?: { id?: string; status?: string } } })?.payment?.entity;
        const updated = await this.prisma.featuredSubscription.update({
          where: { id: record.id },
          data: { status: 'active', paidCount: { increment: 1 }, currentStart, currentEnd },
        });
        if (payment?.status === 'captured') {
          // Close out whatever period is still marked active before opening
          // the new one, so exactly one row is ever 'active' at a time.
          await this.prisma.featured.updateMany({ where: { featuredSubscriptionId: record.id, status: 'active' }, data: { status: 'expired' } });
          await this.startPeriod(updated, currentEnd, payment.id);
          await this.notifyOwner(type, record.refId, 'featured_renewed');
          if (payment.id) {
            const ownerUserId = await this.resolveOwnerUserId(type, record.refId);
            if (ownerUserId) await this.razorpay.getPayment(payment.id).then((p) => this.wallet.saveUsedMethod(ownerUserId, p)).catch(() => {});
          }
        }
        break;
      }

      case 'subscription.pending':
        await this.prisma.featuredSubscription.update({ where: { id: record.id }, data: { status: 'pending' } });
        break;

      case 'subscription.halted':
        await this.prisma.featuredSubscription.update({ where: { id: record.id }, data: { status: 'halted' } });
        await this.prisma.featured.updateMany({ where: { featuredSubscriptionId: record.id, status: 'active' }, data: { status: 'expired' } });
        await this.notifyOwner(type, record.refId, 'featured_subscription_halted');
        await this.staffAlerts.alert(`⚠️ Featured auto-renewal halted — ${type} ${record.refId}`).catch(() => {});
        break;

      case 'subscription.cancelled':
      case 'subscription.completed':
      case 'subscription.expired':
        await this.prisma.featuredSubscription.update({ where: { id: record.id }, data: { status: event.split('.')[1] as never } });
        await this.prisma.featured.updateMany({ where: { featuredSubscriptionId: record.id, status: 'active' }, data: { status: 'expired' } });
        break;
    }
  }

  /** Creates the immutable period row for one billed cycle and, since no
   * admin re-review is needed for an already-subscribed placement, an
   * invoice right alongside it — matching the one-time flow's own "an
   * invoice is a billing document that claims money changed hands" rule,
   * just fired from the webhook instead of confirmPayment. */
  private async startPeriod(
    sub: { id: string; type: string; refId: string; city: string; amount: number; gstPct: number; gstAmount: number; total: number },
    currentEnd: Date | undefined,
    paymentId?: string,
  ) {
    const type = sub.type as FeaturedType;
    const period = await this.prisma.featured.create({
      data: {
        type: type as never, refId: sub.refId, city: sub.city, status: 'active', billing: 'monthly',
        amount: sub.amount, gstPct: sub.gstPct, gstAmount: sub.gstAmount, total: sub.total,
        expiresAt: currentEnd ?? monthFromNow(), paid: true, paymentId, featuredSubscriptionId: sub.id,
      },
    });

    // Invoice is a real billing record regardless of whether there's an
    // email to notify — same "if (user)", not "if (user.email)" reasoning
    // as confirmPayment's own invoice creation. Owner-not-found (deleted
    // account) is the only case that legitimately skips it.
    const target = await this.resolveOwnerAndLabel(type, sub.refId);
    if (target) {
      const business = await this.resolveBillingIdentity(type, sub.refId);
      await this.invoices.create({
        type: 'featured', refId: period.id, role: type === 'event' ? 'organizer' : (type as never),
        payerName: target.name, payerEmail: target.email ?? undefined, payerPhone: target.phone ?? undefined, city: sub.city,
        payerBrand: business?.brand, payerGstin: business?.gstin, payerPan: business?.pan,
        description: `Featured placement (auto-renews monthly) — ${target.itemLabel}`,
        subtotal: sub.amount, gstPct: sub.gstPct, gstAmount: sub.gstAmount, total: sub.total,
      }).catch(() => {});
    }
    return period;
  }

  private async notifyOwner(type: FeaturedType, refId: string, templateId: 'featured_activated' | 'featured_renewed' | 'featured_subscription_halted') {
    const target = await this.resolveOwnerAndLabel(type, refId);
    if (!target?.email) return;
    await this.email.sendTemplate(target.email, templateId, { name: target.name, itemLabel: target.itemLabel }).catch(() => {});
  }

  private async resolveOwnerUserId(type: FeaturedType, refId: string): Promise<string | null> {
    const target = await this.resolveOwnerAndLabel(type, refId);
    return target?.userId ?? null;
  }

  async rates() {
    const s = await this.prisma.platformSettings.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main' } });
    return {
      perEvent: s.featuredPerEvent,
      organizerMonthly: s.featuredOrganizerMonthly,
      promoterMonthly: s.featuredPromoterMonthly,
      lineupMonthly: s.featuredLineupMonthly,
      venueMonthly: s.featuredVenueMonthly,
    };
  }

  async updateRates(body: Partial<typeof FALLBACK_RATES>) {
    const data: Record<string, number> = {};
    if (body.perEvent !== undefined) data.featuredPerEvent = body.perEvent;
    if (body.organizerMonthly !== undefined) data.featuredOrganizerMonthly = body.organizerMonthly;
    if (body.promoterMonthly !== undefined) data.featuredPromoterMonthly = body.promoterMonthly;
    if (body.lineupMonthly !== undefined) data.featuredLineupMonthly = body.lineupMonthly;
    if (body.venueMonthly !== undefined) data.featuredVenueMonthly = body.venueMonthly;
    await this.prisma.platformSettings.upsert({ where: { id: 'main' }, update: data, create: { id: 'main', ...data } });
    return this.rates();
  }

  // ---------- admin: minimal review queue, same pattern as /admin/events ----------
  async listForAdmin(status?: string) {
    const rows = await this.prisma.featured.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'asc' },
    });
    const names = await Promise.all(rows.map((r) => this.resolveOwnerAndLabel(r.type as FeaturedType, r.refId)));
    return rows.map((r, i) => ({ ...r, entityName: names[i]?.itemLabel ?? r.refId }));
  }

  /** Read-only admin billing visibility across every auto-renewing Featured
   * subscription — same "no god-mode write" boundary as
   * AdminSubscriptionsController: the actual subscribe/cancel actions stay
   * on the owner's own self-serve endpoints above, admin can only look. */
  async listSubscriptionsForAdmin() {
    const rows = await this.prisma.featuredSubscription.findMany({ orderBy: { updatedAt: 'desc' } });
    const names = await Promise.all(rows.map((r) => this.resolveOwnerAndLabel(r.type as FeaturedType, r.refId)));
    return rows.map((r, i) => ({ ...r, entityName: names[i]?.itemLabel ?? r.refId }));
  }

  async adminApprove(id: string) {
    const row = await this.prisma.featured.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Featured request not found');
    if (!row.paid) throw new BadRequestException('Cannot approve a featured request that hasn’t been paid for yet');
    return this.prisma.featured.update({ where: { id }, data: { status: 'active' } });
  }

  async adminReject(id: string) {
    const row = await this.prisma.featured.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Featured request not found');
    return this.prisma.featured.update({ where: { id }, data: { status: 'rejected' } });
  }

  /** Manual "remind" action for a lapsed placement (Admin > Featured >
   * Expired tab) — resolves whichever role actually owns `refId` (an event's
   * "owner" is its organizer, since events don't have their own login) and
   * sends the featured_expired_reminder template. Doesn't require `status`
   * to already be 'expired' — a manual reminder is still a reasonable admin
   * action on an about-to-expire active placement, not just a lapsed one. */
  async adminRemind(id: string) {
    const row = await this.prisma.featured.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Featured request not found');

    const target = await this.resolveOwnerAndLabel(row.type as FeaturedType, row.refId);
    if (!target?.email) throw new BadRequestException('No contact email on file for this placement’s owner');

    await this.email
      .sendTemplate(target.email, 'featured_expired_reminder', {
        name: target.name,
        itemLabel: target.itemLabel,
        expiredOn: row.expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
      })
      .catch((err) => {
        throw new BadRequestException(`Reminder email failed to send: ${(err as Error).message}`);
      });

    return { ok: true, sentTo: target.email };
  }

  /** Automatic — called daily by CronService.featuredExpiringSoonTick.
   * Distinct from adminRemind above: this fires proactively on *active*
   * placements within 3 days of expiry (not yet lapsed), and only once per
   * placement (`expiryReminderSentAt` gates re-sends) rather than being a
   * manual, repeatable admin action. */
  async remindExpiringSoon(): Promise<{ remindedCount: number }> {
    const in3Days = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
    const rows = await this.prisma.featured.findMany({
      // featuredSubscriptionId: null — a subscription-backed placement
      // renews itself; nudging the owner to manually renew would be both
      // wrong (nothing lapses) and confusing (they already have auto-pay on).
      where: { status: 'active', expiresAt: { lte: in3Days, gt: new Date() }, expiryReminderSentAt: null, featuredSubscriptionId: null },
    });

    let remindedCount = 0;
    for (const row of rows) {
      const target = await this.resolveOwnerAndLabel(row.type as FeaturedType, row.refId);
      if (!target?.email) continue;
      await this.email
        .sendTemplate(target.email, 'featured_expiring_soon', {
          name: target.name,
          itemLabel: target.itemLabel,
          expiresOn: row.expiresAt.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }),
        })
        .catch(() => {});
      await this.prisma.featured.update({ where: { id: row.id }, data: { expiryReminderSentAt: new Date() } });
      remindedCount++;
    }
    return { remindedCount };
  }

  private async resolveOwnerAndLabel(
    type: FeaturedType,
    refId: string,
  ): Promise<{ email: string | null; phone: string | null; userId: string | null; name: string; itemLabel: string } | null> {
    if (type === 'event') {
      const event = await this.prisma.event.findUnique({ where: { id: refId }, include: { organizer: true, venue: true } });
      if (!event) return null;
      // Solo venue-hosted event — the venue's own account is "the owner"
      // for notification/billing purposes, same fallback as resolveBillingIdentity.
      if (!event.organizer) {
        const venueOwner = event.venue?.userId ? await this.prisma.user.findUnique({ where: { id: event.venue.userId } }) : null;
        return { email: venueOwner?.email ?? null, phone: venueOwner?.phone ?? null, userId: venueOwner?.id ?? null, name: event.venue?.name ?? event.title, itemLabel: event.title };
      }
      const owner = event.organizer.userId ? await this.prisma.user.findUnique({ where: { id: event.organizer.userId } }) : null;
      return { email: owner?.email ?? null, phone: owner?.phone ?? null, userId: owner?.id ?? null, name: event.organizer.brandName, itemLabel: event.title };
    }
    if (type === 'organizer') {
      const org = await this.prisma.organizer.findUnique({ where: { id: refId } });
      if (!org) return null;
      const owner = org.userId ? await this.prisma.user.findUnique({ where: { id: org.userId } }) : null;
      return { email: owner?.email ?? null, phone: owner?.phone ?? null, userId: owner?.id ?? null, name: org.brandName, itemLabel: org.brandName };
    }
    if (type === 'promoter') {
      const p = await this.prisma.promoter.findFirst({ where: { OR: [{ id: refId }, { slug: refId }] } });
      if (!p) return null;
      const owner = p.userId ? await this.prisma.user.findUnique({ where: { id: p.userId } }) : null;
      return { email: owner?.email ?? null, phone: owner?.phone ?? null, userId: owner?.id ?? null, name: p.name, itemLabel: p.name };
    }
    if (type === 'lineup') {
      const l = await this.prisma.lineup.findFirst({ where: { OR: [{ id: refId }, { slug: refId }] } });
      if (!l) return null;
      const owner = l.userId ? await this.prisma.user.findUnique({ where: { id: l.userId } }) : null;
      return { email: owner?.email ?? null, phone: owner?.phone ?? null, userId: owner?.id ?? null, name: l.name, itemLabel: l.name };
    }
    // venue: linked in the reverse direction (User.venueId), no Venue.userId FK
    const venue = await this.prisma.venue.findUnique({ where: { id: refId } });
    if (!venue) return null;
    const owner = await this.prisma.user.findFirst({ where: { venueId: refId } });
    return { email: owner?.email ?? null, phone: owner?.phone ?? null, userId: owner?.id ?? null, name: venue.name, itemLabel: venue.name };
  }
}
