import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../notifications/email';
import { InvoicesService } from '../invoices/invoices.service';
import { RazorpayService } from '../payments/razorpay.service';
import { WalletService } from '../wallet/wallet.service';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { AnalyticsReportService } from '../analytics/analytics-report.service';

export type MarketingOwnerType = 'organizer' | 'venue';

interface RazorpaySubEntity {
  id: string;
  current_start?: number | null;
  current_end?: number | null;
}

function in30Days(): Date {
  return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
}

/**
 * Organizer/venue-paid Meta ad marketing — pay-per-event (one-time) or a
 * rolling 30-day subscription covering all their events, mirroring
 * FeaturedService's exact payment shape (real Razorpay order/subscription,
 * confirm-then-invoice, admin review queue) but for a different product.
 * This service never talks to Meta's own API — campaign creation stays a
 * manual/human step (see AdminMarketingController); it only handles money
 * and gates access to the existing on-site funnel analytics
 * (AnalyticsReportService) for whichever event/period was actually paid
 * for. Every method that changes money is owner-only (Organizer.userId /
 * User.venueId directly), never delegated through team permissions — same
 * boundary FeaturedService draws around billing.
 */
@Injectable()
export class MarketingService {
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private invoices: InvoicesService,
    private razorpay: RazorpayService,
    private wallet: WalletService,
    private staffAlerts: StaffAlertsService,
    private analyticsReport: AnalyticsReportService,
  ) {}

  private async resolveOwner(userId: string, ownerType: MarketingOwnerType): Promise<{ organizerId?: string; venueId?: string; brand: string; city: string }> {
    if (ownerType === 'organizer') {
      const org = await this.prisma.organizer.findUnique({ where: { userId } });
      if (!org) throw new ForbiddenException('Not an organizer account');
      return { organizerId: org.id, brand: org.brandName, city: org.city };
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.venueId) throw new ForbiddenException('Not a venue account');
    const venue = await this.prisma.venue.findUnique({ where: { id: user.venueId } });
    if (!venue) throw new NotFoundException('Venue not found');
    return { venueId: venue.id, brand: venue.name, city: venue.city };
  }

  private ownerIdOf(ownerType: MarketingOwnerType, owner: { organizerId?: string; venueId?: string }): string {
    const id = ownerType === 'organizer' ? owner.organizerId : owner.venueId;
    if (!id) throw new ForbiddenException();
    return id;
  }

  private subUniqueWhere(ownerType: MarketingOwnerType, ownerId: string) {
    return ownerType === 'organizer' ? { organizerId: ownerId } : { venueId: ownerId };
  }

  /** Confirms the event actually belongs to the caller's own organizer/venue
   * — never trusts a client-supplied eventId alone. Same ownership rule
   * VenueService already uses for its own hosted events (event.venueId +
   * hostedByVenue), and the organizer-owned equivalent. */
  private async resolveOwnedEvent(ownerType: MarketingOwnerType, ownerId: string, eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new NotFoundException('Event not found');
    if (ownerType === 'organizer' && event.organizerId !== ownerId) throw new ForbiddenException('Not your event');
    if (ownerType === 'venue' && (event.venueId !== ownerId || !event.hostedByVenue)) throw new ForbiddenException('Not your event');
    return event;
  }

  private async resolveBillingIdentity(ownerType: MarketingOwnerType, ownerId: string): Promise<{ brand: string; gstin?: string | null; pan?: string | null } | null> {
    if (ownerType === 'organizer') {
      const org = await this.prisma.organizer.findUnique({ where: { id: ownerId } });
      if (!org) return null;
      const profile = await this.prisma.paymentProfile.findFirst({ where: { organizerId: org.id, isDefault: true } });
      return { brand: org.brandName, gstin: profile?.gstin, pan: profile?.pan };
    }
    const venue = await this.prisma.venue.findUnique({ where: { id: ownerId } });
    return venue ? { brand: venue.name } : null; // venues have no GSTIN/PAN modeled, same as Featured's venue case
  }

  async rates() {
    const s = await this.prisma.platformSettings.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main' } });
    return { perEvent: s.marketingPerEvent, monthly: s.marketingMonthly, marginPct: s.marketingMarginPct };
  }

  async updateRates(body: { perEvent?: number; monthly?: number; marginPct?: number }) {
    const data: Record<string, number> = {};
    if (body.perEvent !== undefined) data.marketingPerEvent = body.perEvent;
    if (body.monthly !== undefined) data.marketingMonthly = body.monthly;
    if (body.marginPct !== undefined) data.marketingMarginPct = body.marginPct;
    await this.prisma.platformSettings.upsert({ where: { id: 'main' }, update: data, create: { id: 'main', ...data } });
    return this.rates();
  }

  /** Strips everything that isn't meant for organizer/venue eyes —
   * marginPct, metaCampaignId, and the raw Razorpay ids never leave this
   * service. Only what they paid, for what, and its status. */
  private toPublicOrder(row: { id: string; eventId: string | null; eventTitle: string | null; amount: number; status: string; createdAt: Date; marketingSubscriptionId: string | null; periodStart: Date | null; periodEnd: Date | null }) {
    return {
      id: row.id, eventId: row.eventId, eventTitle: row.eventTitle, amount: row.amount, status: row.status,
      createdAt: row.createdAt, isSubscriptionPeriod: !!row.marketingSubscriptionId, periodStart: row.periodStart, periodEnd: row.periodEnd,
    };
  }

  private toPublicSubscription(row: { id: string; amountPerCycle: number; status: string; currentStart: Date | null; currentEnd: Date | null; paidCount: number; shortUrl: string | null } | null) {
    if (!row) return null;
    return { id: row.id, amountPerCycle: row.amountPerCycle, status: row.status, currentStart: row.currentStart, currentEnd: row.currentEnd, paidCount: row.paidCount, shortUrl: row.shortUrl };
  }

  // ---------- pay-per-event (one-time) ----------

  async requestForEvent(userId: string, ownerType: MarketingOwnerType, eventId: string) {
    const owner = await this.resolveOwner(userId, ownerType);
    const ownerId = this.ownerIdOf(ownerType, owner);
    const event = await this.resolveOwnedEvent(ownerType, ownerId, eventId);

    const existing = await this.prisma.marketingOrder.findFirst({ where: { eventId, status: { in: ['pending', 'active'] } } });
    if (existing) throw new BadRequestException('This event already has a marketing order in progress or active');

    const rates = await this.rates();
    const amount = rates.perEvent;

    const row = await this.prisma.marketingOrder.create({
      data: {
        ownerType: ownerType as never,
        organizerId: ownerType === 'organizer' ? ownerId : undefined,
        venueId: ownerType === 'venue' ? ownerId : undefined,
        eventId: event.id, eventTitle: event.title,
        amount, marginPct: rates.marginPct, status: 'pending',
      },
    });

    const { orderId } = await this.razorpay.createOrder(amount * 100, row.id);
    await this.prisma.marketingOrder.update({ where: { id: row.id }, data: { razorpayOrderId: orderId } });

    return { id: row.id, amount, razorpayOrder: { orderId, amount: amount * 100, keyId: process.env.RAZORPAY_KEY_ID || undefined } };
  }

  async confirmPayment(userId: string, ownerType: MarketingOwnerType, id: string, proof: { paymentId: string; signature: string }) {
    const row = await this.prisma.marketingOrder.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Marketing order not found');
    const owner = await this.resolveOwner(userId, ownerType);
    const ownerId = this.ownerIdOf(ownerType, owner);
    if (row.ownerType !== ownerType || (ownerType === 'organizer' ? row.organizerId : row.venueId) !== ownerId) throw new ForbiddenException();
    if (!row.razorpayOrderId) throw new BadRequestException('This order has no payment to confirm');
    if (row.paymentId) return this.toPublicOrder(row); // already confirmed

    const valid = this.razorpay.verifyPaymentSignature(row.razorpayOrderId, proof.paymentId, proof.signature);
    if (!valid) throw new BadRequestException('Payment verification failed');

    const updated = await this.prisma.marketingOrder.update({ where: { id }, data: { paymentId: proof.paymentId } });

    await this.razorpay.getPayment(proof.paymentId).then((p) => this.wallet.saveUsedMethod(userId, p)).catch(() => {});

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const business = await this.resolveBillingIdentity(ownerType, ownerId);
      await this.invoices.create({
        type: 'marketing', refId: row.id, role: ownerType,
        payerName: user.name, payerEmail: user.email, payerPhone: user.phone, city: owner.city,
        payerBrand: business?.brand, payerGstin: business?.gstin, payerPan: business?.pan,
        description: `Marketing campaign — ${row.eventTitle ?? owner.brand}`,
        subtotal: row.amount, gstPct: 0, gstAmount: 0, total: row.amount,
      }).catch(() => {});
      await this.staffAlerts.alert(`📣 New marketing order paid — ${owner.brand} (${row.eventTitle ?? 'event'}), ₹${row.amount}`).catch(() => {});
    }

    return this.toPublicOrder(updated);
  }

  async myOrders(userId: string, ownerType: MarketingOwnerType) {
    const owner = await this.resolveOwner(userId, ownerType);
    const ownerId = this.ownerIdOf(ownerType, owner);
    const rows = await this.prisma.marketingOrder.findMany({
      where: ownerType === 'organizer' ? { organizerId: ownerId } : { venueId: ownerId },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => this.toPublicOrder(r));
  }

  // ---------- auto-renewing subscription (org-wide, rolling 30-day) ----------

  async subscribe(userId: string, ownerType: MarketingOwnerType) {
    const owner = await this.resolveOwner(userId, ownerType);
    const ownerId = this.ownerIdOf(ownerType, owner);
    const rates = await this.rates();
    const amount = rates.monthly;

    const { planId } = await this.razorpay.createPlan(`Marketing — ${ownerType}`, amount * 100, `Prebooze marketing subscription (${ownerType}, auto-renews every 30 days)`);
    const sub = await this.razorpay.createSubscription(planId, { ownerType, ownerId });

    const row = await this.prisma.marketingSubscription.upsert({
      where: this.subUniqueWhere(ownerType, ownerId),
      create: {
        ownerType: ownerType as never,
        organizerId: ownerType === 'organizer' ? ownerId : undefined,
        venueId: ownerType === 'venue' ? ownerId : undefined,
        amountPerCycle: amount, marginPct: rates.marginPct,
        razorpaySubId: sub.subscriptionId, status: 'created', shortUrl: sub.shortUrl,
      },
      update: {
        amountPerCycle: amount, marginPct: rates.marginPct, razorpaySubId: sub.subscriptionId,
        status: 'created', shortUrl: sub.shortUrl, currentStart: null, currentEnd: null, paidCount: 0,
      },
    });

    return { ok: true, requiresAuthorization: true, id: row.id, subscriptionId: sub.subscriptionId, shortUrl: sub.shortUrl, keyId: process.env.RAZORPAY_KEY_ID || undefined };
  }

  async cancelSubscription(userId: string, ownerType: MarketingOwnerType) {
    const owner = await this.resolveOwner(userId, ownerType);
    const ownerId = this.ownerIdOf(ownerType, owner);
    const sub = await this.prisma.marketingSubscription.findUnique({ where: this.subUniqueWhere(ownerType, ownerId) });
    if (!sub || sub.status === 'cancelled') throw new BadRequestException('No active auto-renewing marketing subscription to cancel');
    if (sub.razorpaySubId) await this.razorpay.cancelSubscription(sub.razorpaySubId, true);
    await this.prisma.marketingSubscription.update({ where: { id: sub.id }, data: { status: 'cancelled' } });
    return { ok: true };
  }

  async mySubscription(userId: string, ownerType: MarketingOwnerType) {
    const owner = await this.resolveOwner(userId, ownerType);
    const ownerId = this.ownerIdOf(ownerType, owner);
    const sub = await this.prisma.marketingSubscription.findUnique({ where: this.subUniqueWhere(ownerType, ownerId) });
    return this.toPublicSubscription(sub);
  }

  /** Dispatches a verified Razorpay webhook event — identical shape to
   * FeaturedService.handleWebhookEvent, keyed against
   * MarketingSubscription.razorpaySubId instead. Silently no-ops when the
   * subscription id isn't ours (see RazorpayWebhookController). */
  async handleWebhookEvent(event: string, payload: unknown) {
    const subEntity = (payload as { subscription?: { entity?: RazorpaySubEntity } })?.subscription?.entity;
    if (!subEntity?.id) return;

    const record = await this.prisma.marketingSubscription.findUnique({ where: { razorpaySubId: subEntity.id } });
    if (!record) return; // not ours

    const currentStart = subEntity.current_start ? new Date(subEntity.current_start * 1000) : undefined;
    const currentEnd = subEntity.current_end ? new Date(subEntity.current_end * 1000) : undefined;

    switch (event) {
      case 'subscription.authenticated':
        await this.prisma.marketingSubscription.update({ where: { id: record.id }, data: { status: 'authenticated' } });
        break;

      case 'subscription.activated': {
        const updated = await this.prisma.marketingSubscription.update({
          where: { id: record.id },
          data: { status: 'active', currentStart: currentStart ?? new Date(), currentEnd, shortUrl: null },
        });
        await this.startPeriod(updated, currentEnd);
        await this.notifyOwner(record, 'marketing_subscription_activated');
        break;
      }

      case 'subscription.charged': {
        const payment = (payload as { payment?: { entity?: { id?: string; status?: string } } })?.payment?.entity;
        const updated = await this.prisma.marketingSubscription.update({
          where: { id: record.id },
          data: { status: 'active', paidCount: { increment: 1 }, currentStart, currentEnd },
        });
        if (payment?.status === 'captured') {
          await this.startPeriod(updated, currentEnd, payment.id);
          await this.notifyOwner(record, 'marketing_subscription_renewed');
          const ownerUserId = await this.resolveOwnerUserId(record);
          if (payment.id && ownerUserId) await this.razorpay.getPayment(payment.id).then((p) => this.wallet.saveUsedMethod(ownerUserId, p)).catch(() => {});
        }
        break;
      }

      case 'subscription.pending':
        await this.prisma.marketingSubscription.update({ where: { id: record.id }, data: { status: 'pending' } });
        break;

      case 'subscription.halted':
        await this.prisma.marketingSubscription.update({ where: { id: record.id }, data: { status: 'halted' } });
        await this.notifyOwner(record, 'marketing_subscription_halted');
        await this.staffAlerts.alert(`⚠️ Marketing auto-renewal halted — ${record.ownerType} ${record.organizerId ?? record.venueId}`).catch(() => {});
        break;

      case 'subscription.cancelled':
      case 'subscription.completed':
      case 'subscription.expired':
        await this.prisma.marketingSubscription.update({ where: { id: record.id }, data: { status: event.split('.')[1] as never } });
        break;
    }
  }

  /** Creates the immutable billing-history row for one charged cycle
   * (periodStart/periodEnd define the 30-day window whose events become
   * eligible for the Analytics screen) and, since no admin re-review is
   * needed for an already-subscribed arrangement, an invoice right
   * alongside it — same reasoning as FeaturedService.startPeriod. */
  private async startPeriod(
    sub: { id: string; ownerType: string; organizerId: string | null; venueId: string | null; amountPerCycle: number; marginPct: number },
    currentEnd: Date | undefined,
    paymentId?: string,
  ) {
    const periodEnd = currentEnd ?? in30Days();
    const period = await this.prisma.marketingOrder.create({
      data: {
        ownerType: sub.ownerType as never, organizerId: sub.organizerId, venueId: sub.venueId,
        amount: sub.amountPerCycle, marginPct: sub.marginPct, status: 'active', paymentId,
        marketingSubscriptionId: sub.id, periodStart: new Date(), periodEnd,
      },
    });

    const target = await this.resolveOwnerContact(sub);
    if (target) {
      const business = await this.resolveBillingIdentity(sub.ownerType as MarketingOwnerType, (sub.organizerId ?? sub.venueId)!);
      await this.invoices.create({
        type: 'marketing', refId: period.id, role: sub.ownerType as never,
        payerName: target.name, payerEmail: target.email ?? undefined, payerPhone: target.phone ?? undefined,
        payerBrand: business?.brand, payerGstin: business?.gstin, payerPan: business?.pan,
        description: `Marketing subscription (auto-renews every 30 days) — ${target.brand}`,
        subtotal: sub.amountPerCycle, gstPct: 0, gstAmount: 0, total: sub.amountPerCycle,
      }).catch(() => {});
    }
    return period;
  }

  private async resolveOwnerContact(sub: { ownerType: string; organizerId: string | null; venueId: string | null }): Promise<{ email: string | null; phone: string | null; userId: string | null; name: string; brand: string } | null> {
    if (sub.ownerType === 'organizer' && sub.organizerId) {
      const org = await this.prisma.organizer.findUnique({ where: { id: sub.organizerId } });
      if (!org) return null;
      const owner = org.userId ? await this.prisma.user.findUnique({ where: { id: org.userId } }) : null;
      return { email: owner?.email ?? null, phone: owner?.phone ?? null, userId: owner?.id ?? null, name: owner?.name ?? org.brandName, brand: org.brandName };
    }
    if (sub.ownerType === 'venue' && sub.venueId) {
      const venue = await this.prisma.venue.findUnique({ where: { id: sub.venueId } });
      if (!venue) return null;
      const owner = await this.prisma.user.findFirst({ where: { venueId: sub.venueId } });
      return { email: owner?.email ?? null, phone: owner?.phone ?? null, userId: owner?.id ?? null, name: owner?.name ?? venue.name, brand: venue.name };
    }
    return null;
  }

  private async notifyOwner(sub: { ownerType: string; organizerId: string | null; venueId: string | null }, templateId: 'marketing_subscription_activated' | 'marketing_subscription_renewed' | 'marketing_subscription_halted') {
    const target = await this.resolveOwnerContact(sub);
    if (!target?.email) return;
    await this.email.sendTemplate(target.email, templateId, { name: target.name, brand: target.brand }).catch(() => {});
  }

  private async resolveOwnerUserId(sub: { ownerType: string; organizerId: string | null; venueId: string | null }): Promise<string | null> {
    const target = await this.resolveOwnerContact(sub);
    return target?.userId ?? null;
  }

  /** Is this specific event currently covered by a paid marketing
   * arrangement — an active/completed one-time MarketingOrder for it, or
   * falling inside an active MarketingSubscription's current 30-day window?
   * The one gate the new Analytics endpoint checks before calling into
   * AnalyticsReportService — see MarketingController. */
  async isEventCovered(ownerType: MarketingOwnerType, ownerId: string, eventId: string): Promise<boolean> {
    const order = await this.prisma.marketingOrder.findFirst({
      where: {
        eventId,
        status: { in: ['active', 'expired'] }, // 'expired' = event has passed but was legitimately run
        ...(ownerType === 'organizer' ? { organizerId: ownerId } : { venueId: ownerId }),
      },
    });
    if (order) return true;

    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { date: true } });
    if (!event) return false;
    const sub = await this.prisma.marketingSubscription.findUnique({ where: this.subUniqueWhere(ownerType, ownerId) });
    if (!sub || sub.status !== 'active' || !sub.currentStart || !sub.currentEnd) return false;
    return event.date >= sub.currentStart && event.date <= sub.currentEnd;
  }

  /** The "Analytics" screen's one data source — reuses
   * AnalyticsReportService.get() verbatim (the exact same aggregation admin
   * already sees) but gated on isEventCovered above and stripped down to a
   * safe subset. Deliberately excludes `revenue`, `promoterAttribution`,
   * `ticketTierSales`, `revenueByAdPlatform`, `revenueByCampaign` — those
   * carry platform-internal money/commission figures that have nothing to
   * do with "how is my event performing" and were never meant for an
   * organizer/venue to see. Throws ForbiddenException for an event with no
   * active/completed paid marketing arrangement — the caller falls back to
   * whatever basic stats their dashboard already shows. */
  async analyticsFor(userId: string, ownerType: MarketingOwnerType, eventId: string) {
    const owner = await this.resolveOwner(userId, ownerType);
    const ownerId = this.ownerIdOf(ownerType, owner);
    await this.resolveOwnedEvent(ownerType, ownerId, eventId); // throws if not theirs
    const covered = await this.isEventCovered(ownerType, ownerId, eventId);
    if (!covered) throw new ForbiddenException('No active marketing arrangement for this event');

    const full = await this.analyticsReport.get({ eventId });
    return {
      stages: full.stages, totalEvents: full.totalEvents,
      // `revenue` dropped per-day too, not just the top-level field — same
      // "no money figures" rule applies at every level of the response.
      daily: full.daily.map((d) => ({ date: d.date, viewed: d.viewed, completed: d.completed })),
      devices: full.devices, browsers: full.browsers, operatingSystems: full.operatingSystems,
      trafficSources: full.trafficSources, campaigns: full.campaigns, geographies: full.geographies,
      regions: full.regions, adPlatforms: full.adPlatforms, visitorType: full.visitorType,
      heatmap: full.heatmap, paymentFailures: full.paymentFailures,
    };
  }

  // ---------- admin: minimal review queue + Meta campaign handoff ----------

  async listOrdersForAdmin(status?: string) {
    const rows = await this.prisma.marketingOrder.findMany({
      where: status ? { status: status as never } : undefined,
      orderBy: { createdAt: 'desc' },
    });
    const names = await Promise.all(rows.map((r) => this.resolveEntityName(r.ownerType as MarketingOwnerType, r.organizerId ?? r.venueId!)));
    return rows.map((r, i) => ({ ...r, entityName: names[i] ?? (r.organizerId ?? r.venueId) }));
  }

  async listSubscriptionsForAdmin() {
    const rows = await this.prisma.marketingSubscription.findMany({ orderBy: { updatedAt: 'desc' } });
    const names = await Promise.all(rows.map((r) => this.resolveEntityName(r.ownerType as MarketingOwnerType, r.organizerId ?? r.venueId!)));
    return rows.map((r, i) => ({ ...r, entityName: names[i] ?? (r.organizerId ?? r.venueId) }));
  }

  private async resolveEntityName(ownerType: MarketingOwnerType, ownerId: string): Promise<string | null> {
    if (ownerType === 'organizer') return (await this.prisma.organizer.findUnique({ where: { id: ownerId } }))?.brandName ?? null;
    return (await this.prisma.venue.findUnique({ where: { id: ownerId } }))?.name ?? null;
  }

  /** The human handoff point — admin has actually created the real Meta
   * campaign for this order/subscription and is recording its id + marking
   * it live. Requires the order to be paid first (mirrors
   * FeaturedService.adminApprove's "can't approve unpaid" rule). */
  async adminSetCampaign(id: string, metaCampaignId: string) {
    const row = await this.prisma.marketingOrder.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Marketing order not found');
    if (!row.paymentId) throw new BadRequestException('Cannot activate a marketing order that hasn’t been paid for yet');
    return this.prisma.marketingOrder.update({ where: { id }, data: { metaCampaignId, status: 'active' } });
  }

  async adminReject(id: string) {
    const row = await this.prisma.marketingOrder.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Marketing order not found');
    return this.prisma.marketingOrder.update({ where: { id }, data: { status: 'rejected' } });
  }
}
