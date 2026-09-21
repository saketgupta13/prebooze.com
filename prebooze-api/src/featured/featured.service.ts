import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { WhatsappService } from '../notifications/whatsapp';
import { EmailService } from '../notifications/email';
import { money } from '../notifications/email-templates';
import { InvoicesService } from '../invoices/invoices.service';
import { PhonePeService } from '../payments/phonepe.service';
import { WalletService } from '../wallet/wallet.service';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { calculateGatewayFee, type PaymentMethod } from '../payments/gateway-fee';
import { computeGst } from '../common/gst';

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
  private razorpay: any = null;
  constructor(
    private prisma: PrismaService,
    private wa: WhatsappService,
    private email: EmailService,
    private invoices: InvoicesService,
    private phonepe: PhonePeService,
    private wallet: WalletService,
    private staffAlerts: StaffAlertsService,
  ) {}

  /** Resolves ownership + the server-trusted city/expiry for a request —
   * never the client's. Throws ForbiddenException if the caller doesn't
   * actually own refId. */
  private async resolveTarget(userId: string, type: FeaturedType, refId: string): Promise<{ city: string; state: string | null; expiresAt: Date }> {
    switch (type) {
      case 'event': {
        const org = await this.prisma.organizer.findUnique({ where: { userId } });
        const event = await this.prisma.event.findUnique({ where: { id: refId }, include: { venue: true } });
        if (!org || !event || event.organizerId !== org.id) throw new ForbiddenException();
        const city = event.venue?.city ?? event.privateCity;
        if (!city) throw new ForbiddenException();
        return { city, state: event.venue?.state ?? null, expiresAt: event.date };
      }
      case 'organizer': {
        const org = await this.prisma.organizer.findUnique({ where: { userId } });
        if (!org || org.id !== refId) throw new ForbiddenException();
        return { city: org.city, state: org.state ?? null, expiresAt: monthFromNow() };
      }
      case 'promoter': {
        const p = await this.prisma.promoter.findUnique({ where: { userId } });
        if (!p || p.slug !== refId) throw new ForbiddenException();
        return { city: p.city, state: p.state ?? null, expiresAt: monthFromNow() };
      }
      case 'lineup': {
        const l = await this.prisma.lineup.findUnique({ where: { userId } });
        if (!l || l.slug !== refId) throw new ForbiddenException();
        return { city: l.city, state: l.state ?? null, expiresAt: monthFromNow() };
      }
      case 'venue': {
        const user = await this.prisma.user.findUnique({ where: { id: userId } });
        if (!user?.venueId || user.venueId !== refId) throw new ForbiddenException();
        const venue = await this.prisma.venue.findUnique({ where: { id: refId } });
        if (!venue) throw new NotFoundException();
        return { city: venue.city, state: venue.state ?? null, expiresAt: monthFromNow() };
      }
      default:
        throw new BadRequestException('Unknown featured type');
    }
  }

  /** Creates the request AND a real PhonePe order for the amount owed —
   * the request stays `paid: false` until `confirmPayment` verifies a real
   * payment; `adminApprove` refuses to approve an unpaid one. No Invoice is
   * created here — an invoice is a billing document that claims money
   * changed hands, and at this point it hasn't. It used to be created
   * unconditionally right here, so cancelling checkout still left behind a
   * real, "issued" invoice for a payment that never happened. It's created
   * in confirmPayment now, only once the payment actually verifies. GST
   * (real GSTIN activated 2026-09-21) is charged on the FULL amount here —
   * unlike a guest ticket booking, this whole amount IS Prebooze's own
   * revenue (a direct Featured-placement sale), not a pass-through of an
   * organizer's ticket sale. gstPct/gstAmount lock in the rate at request
   * time (not confirmPayment time) so a later admin rate change never
   * retroactively changes what this exact request already quoted — same
   * reasoning the pre-existing doc comment on these columns already gave
   * for Razorpay. gstEnabled false (the default, and every pre-launch
   * request) keeps both 0 and total===amount, unchanged from before. */
  async request(userId: string, input: { type: FeaturedType; refId: string; billing: 'per_event' | 'monthly' }) {
    if (!input.type || !input.refId) throw new BadRequestException('type and refId are required');
    if (input.type === 'event' && input.billing !== 'per_event') throw new BadRequestException('Events are featured per-event, not monthly');
    if (input.type !== 'event' && input.billing !== 'monthly') throw new BadRequestException(`${input.type} can only be featured monthly`);

    const { city, expiresAt } = await this.resolveTarget(userId, input.type, input.refId);
    const rates = await this.rates();
    const amount = input.billing === 'per_event' ? rates.perEvent : rates[`${input.type}Monthly` as keyof typeof rates];
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    const gstPct = settings?.gstEnabled ? (settings?.gstPct ?? 0) : 0;
    const gstAmount = Math.round((amount * gstPct) / 100);
    const total = amount + gstAmount;

    // matches the mock's requestFeatured: a fresh request replaces whatever
    // pending/active/expired record already existed for this exact item
    await this.prisma.featured.deleteMany({ where: { type: input.type as never, refId: input.refId } });
    let row = await this.prisma.featured.create({
      data: { type: input.type as never, refId: input.refId, city, billing: input.billing as never, amount, expiresAt, gstPct, gstAmount, total },
    });

    // Only ever reached for type 'event' (the validation above requires
    // 'per_event' billing exclusively for that type) — no live frontend
    // caller exists yet for this path (organizer/promoter/lineup/venue all
    // only ever go through subscribe() below), so /organizer/events is a
    // reasonable placeholder landing page; whoever wires up a real "feature
    // this event" UI later can point returnUrl anywhere else, the
    // featuredId query param is all a resume handler needs regardless.
    const returnUrl = `${process.env.WEB_APP_URL || 'https://prebooze.com'}/organizer/events?phonepe_return=1&featuredId=${encodeURIComponent(row.id)}`;
    const order = await this.phonepe.createOrder(row.id, total * 100, returnUrl);
    row = await this.prisma.featured.update({ where: { id: row.id }, data: { phonepeMerchantOrderId: row.id } });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const itemLabel = `${input.type} (${input.refId})`;
      await this.wa.send(user.phone, 'featured_submitted', [String(amount), itemLabel]).catch(() => {});
      await this.email.sendTemplate(user.email, 'featured_submitted', {
        name: user.name, amount: money(amount), itemLabel,
      }).catch(() => {});
    }

    return { ...row, phonepeRedirectUrl: order.redirectUrl };
  }

  /** Confirms the PhonePe order created in `request()` and marks the
   * placement payable-for-review. Re-checks ownership the same way
   * `request()` did — Featured has no userId column (refId + type is the
   * only link back to an owner), so this is the only way to confirm the
   * caller confirming payment is the same one who made the request. No
   * client-supplied proof anymore — PhonePe's own getOrderStatus is the
   * sole source of truth, same reasoning as bookings.service.ts's create().
   * The real Invoice is created here, once, only on the branch where the
   * order actually completed. */
  async confirmPayment(userId: string, id: string) {
    const row = await this.prisma.featured.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Featured request not found');
    const target = await this.resolveTarget(userId, row.type as FeaturedType, row.refId); // throws if not the owner
    if (!row.phonepeMerchantOrderId) throw new BadRequestException('This request has no payment to confirm');
    if (row.paid) return row;

    const status = await this.phonepe.getOrderStatus(row.phonepeMerchantOrderId);
    if (!status || status.state !== 'COMPLETED') throw new BadRequestException('Payment verification failed');
    if (status.amount !== (row.total ?? 0) * 100) {
      throw new BadRequestException(`This request's price changed since payment — contact support with reference ${row.phonepeMerchantOrderId}`);
    }

    // Fetch payment method for fee calculations and wallet save
    let paymentMethod: string | null = null;
    const methodResult = await this.phonepe.getPaymentMethod(row.phonepeMerchantOrderId).catch(() => null);
    if (methodResult) {
      paymentMethod = methodResult.method;
      // Auto-save the method this real payment actually used — same
      // WalletService.saveUsedMethod dedup-by-matchKey path a guest checkout
      // uses; Featured payments already carry the caller's own real userId.
      await this.wallet.saveUsedMethod(userId, methodResult).catch(() => {});
    }

    const updated = await this.prisma.featured.update({ where: { id }, data: { paid: true, paymentId: row.phonepeMerchantOrderId } });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const itemLabel = `${row.type} (${row.refId})`;
      const business = await this.resolveBillingIdentity(row.type as FeaturedType, row.refId);
      // Split recomputed fresh here (not stored on the row) using the
      // rate locked in at request() time — place of supply is the buyer's
      // own registered state, same reasoning as MarketingService's
      // identical split.
      const gstSplit = computeGst(row.amount, row.gstPct ?? 0, target.state);
      await this.invoices.create({
        type: 'featured', refId: row.id, role: row.type === 'event' ? 'organizer' : (row.type as never),
        payerName: user.name, payerEmail: user.email, payerPhone: user.phone, city: row.city,
        payerBrand: business?.brand, payerGstin: business?.gstin, payerPan: business?.pan,
        description: `Featured placement — ${itemLabel}`,
        subtotal: row.amount, gstPct: gstSplit.gstPct, gstAmount: gstSplit.gstAmount, igstAmount: gstSplit.igstAmount,
        total: row.total ?? row.amount,
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
  // Real Razorpay Subscriptions recurring billing removed 2026-09-21 (see
  // prebooze_razorpay_complete_removal memory) — FeaturedSubscription table
  // dropped, zero active rows at removal time. subscribe()/
  // cancelSubscription() now just refuse; mySubscription() returns null.
  // Historical featuredSubscriptionId/paid one-time Featured rows are
  // untouched — see request()/confirmPayment() above. Will be rebuilt on
  // PhonePe AutoPay once that's available.
  async subscribe(_userId: string, _input: { type: FeaturedType; refId: string }) {
    throw new BadRequestException('Subscriptions are currently unavailable. Use one-time payments instead.');
  }

  async cancelSubscription(_userId: string, _type: FeaturedType, _refId: string) {
    throw new BadRequestException('Subscriptions are currently unavailable.');
  }

  async mySubscription(_userId: string, _type: FeaturedType, _refId: string) {
    return null;
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

  async listSubscriptionsForAdmin() {
    return [];
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
