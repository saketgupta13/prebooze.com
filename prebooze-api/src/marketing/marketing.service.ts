import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../notifications/email';
import { InvoicesService } from '../invoices/invoices.service';
import { PhonePeService } from '../payments/phonepe.service';
import { WalletService } from '../wallet/wallet.service';
import { StaffAlertsService } from '../notifications/staff-alerts';
import { AnalyticsReportService } from '../analytics/analytics-report.service';
import { calculateGatewayFee, type PaymentMethod } from '../payments/gateway-fee';
import { computeGst } from '../common/gst';

export type MarketingOwnerType = 'organizer' | 'venue';

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
  private razorpay: any = null;
  constructor(
    private prisma: PrismaService,
    private email: EmailService,
    private invoices: InvoicesService,
    
    private phonepe: PhonePeService,
    private wallet: WalletService,
    private staffAlerts: StaffAlertsService,
    private analyticsReport: AnalyticsReportService,
  ) {}

  private async resolveOwner(userId: string, ownerType: MarketingOwnerType): Promise<{ organizerId?: string; venueId?: string; brand: string; city: string; state: string | null }> {
    if (ownerType === 'organizer') {
      const org = await this.prisma.organizer.findUnique({ where: { userId } });
      if (!org) throw new ForbiddenException('Not an organizer account');
      return { organizerId: org.id, brand: org.brandName, city: org.city, state: org.state ?? null };
    }
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (!user?.venueId) throw new ForbiddenException('Not a venue account');
    const venue = await this.prisma.venue.findUnique({ where: { id: user.venueId } });
    if (!venue) throw new NotFoundException('Venue not found');
    return { venueId: venue.id, brand: venue.name, city: venue.city, state: venue.state ?? null };
  }

  private ownerIdOf(ownerType: MarketingOwnerType, owner: { organizerId?: string; venueId?: string }): string {
    const id = ownerType === 'organizer' ? owner.organizerId : owner.venueId;
    if (!id) throw new ForbiddenException();
    return id;
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
    return { perEvent: s.marketingPerEvent, monthly: s.marketingMonthly, marginPct: s.marketingMarginPct, gstPct: s.gstEnabled ? s.gstPct : 0 };
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
  // isSubscriptionPeriod is always false now — real Razorpay Subscriptions
  // recurring billing (and the marketingSubscriptionId column that marked a
  // row as subscription-generated) was fully removed 2026-09-21 (see
  // prebooze_razorpay_complete_removal memory); every row left is a
  // one-time purchase. Kept in the response shape rather than dropped
  // outright since callers (admin's own Marketing.tsx) still read it.
  // `amount` stays the base rate (unchanged meaning, matches every existing
  // caller); `total` is what was/will be actually charged, amount+GST —
  // equal to amount on every pre-GST-launch or gstEnabled:false order.
  private toPublicOrder(row: { id: string; eventId: string | null; eventTitle: string | null; amount: number; gstPct: number | null; gstAmount: number | null; total: number | null; status: string; createdAt: Date; periodEnd: Date | null }) {
    return {
      id: row.id, eventId: row.eventId, eventTitle: row.eventTitle, amount: row.amount,
      gstPct: row.gstPct ?? 0, gstAmount: row.gstAmount ?? 0, total: row.total ?? row.amount, status: row.status,
      createdAt: row.createdAt, isSubscriptionPeriod: false, periodEnd: row.periodEnd,
    };
  }

  // ---------- pay-per-event (one-time) ----------

  // GST (real GSTIN activated 2026-09-21) on the FULL amount — same
  // reasoning as FeaturedService.request()'s identical doc comment: this
  // whole amount is Prebooze's own direct revenue, not a pass-through of
  // an organizer's ticket sale. Locked in at request time, same as amount/
  // marginPct already were.
  async requestForEvent(userId: string, ownerType: MarketingOwnerType, eventId: string) {
    const owner = await this.resolveOwner(userId, ownerType);
    const ownerId = this.ownerIdOf(ownerType, owner);
    const event = await this.resolveOwnedEvent(ownerType, ownerId, eventId);

    const existing = await this.prisma.marketingOrder.findFirst({ where: { eventId, status: { in: ['pending', 'active'] } } });
    if (existing) throw new BadRequestException('This event already has a marketing order in progress or active');

    const rates = await this.rates();
    const amount = rates.perEvent;
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    const gstPct = settings?.gstEnabled ? (settings?.gstPct ?? 0) : 0;
    const gstAmount = Math.round((amount * gstPct) / 100);
    const total = amount + gstAmount;

    const row = await this.prisma.marketingOrder.create({
      data: {
        ownerType: ownerType as never,
        organizerId: ownerType === 'organizer' ? ownerId : undefined,
        venueId: ownerType === 'venue' ? ownerId : undefined,
        eventId: event.id, eventTitle: event.title,
        amount, marginPct: rates.marginPct, gstPct, gstAmount, total, status: 'pending',
      },
    });

    // Return path differs by owner type — organizer/venue each have their
    // own Marketing page (Marketing.tsx / VenueMarketing.tsx), both reading
    // the same orderId query param to resume.
    const returnPath = ownerType === 'organizer' ? '/organizer/marketing' : '/venue/hosting/marketing';
    const returnUrl = `${process.env.WEB_APP_URL || 'https://prebooze.com'}${returnPath}?phonepe_return=1&orderId=${encodeURIComponent(row.id)}`;
    const order = await this.phonepe.createOrder(row.id, total * 100, returnUrl);
    await this.prisma.marketingOrder.update({ where: { id: row.id }, data: { phonepeMerchantOrderId: row.id } });

    return { id: row.id, amount, gstPct, gstAmount, total, phonepeRedirectUrl: order.redirectUrl };
  }

  async confirmPayment(userId: string, ownerType: MarketingOwnerType, id: string) {
    const row = await this.prisma.marketingOrder.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Marketing order not found');
    const owner = await this.resolveOwner(userId, ownerType);
    const ownerId = this.ownerIdOf(ownerType, owner);
    if (row.ownerType !== ownerType || (ownerType === 'organizer' ? row.organizerId : row.venueId) !== ownerId) throw new ForbiddenException();
    if (!row.phonepeMerchantOrderId) throw new BadRequestException('This order has no payment to confirm');
    if (row.paymentId) return this.toPublicOrder(row); // already confirmed

    const status = await this.phonepe.getOrderStatus(row.phonepeMerchantOrderId);
    if (!status || status.state !== 'COMPLETED') throw new BadRequestException('Payment verification failed');
    if (status.amount !== (row.total ?? row.amount) * 100) {
      throw new BadRequestException(`This order's price changed since payment — contact support with reference ${row.phonepeMerchantOrderId}`);
    }

    // Fetch payment method for fee calculations and wallet save
    let paymentMethod: string | null = null;
    const methodResult = await this.phonepe.getPaymentMethod(row.phonepeMerchantOrderId).catch(() => null);
    if (methodResult) {
      paymentMethod = methodResult.method;
      // Auto-save the method this real payment actually used
      await this.wallet.saveUsedMethod(userId, methodResult).catch(() => {});
    }

    const updated = await this.prisma.marketingOrder.update({ where: { id }, data: { paymentId: row.phonepeMerchantOrderId } });

    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user) {
      const business = await this.resolveBillingIdentity(ownerType, ownerId);
      const gstSplit = computeGst(row.amount, row.gstPct ?? 0, owner.state);
      await this.invoices.create({
        type: 'marketing', refId: row.id, role: ownerType,
        payerName: user.name, payerEmail: user.email, payerPhone: user.phone, city: owner.city,
        payerBrand: business?.brand, payerGstin: business?.gstin, payerPan: business?.pan,
        description: `Marketing campaign — ${row.eventTitle ?? owner.brand}`,
        subtotal: row.amount, gstPct: gstSplit.gstPct, gstAmount: gstSplit.gstAmount, igstAmount: gstSplit.igstAmount,
        total: row.total ?? row.amount,
      }).catch(() => {});
      await this.staffAlerts.alert(`📣 New marketing order paid — ${owner.brand} (${row.eventTitle ?? 'event'}), ₹${row.total ?? row.amount}`).catch(() => {});
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
  // Real Razorpay Subscriptions recurring billing removed 2026-09-21 (see
  // prebooze_razorpay_complete_removal memory) — MarketingSubscription
  // table dropped, zero active rows at removal time. subscribe()/
  // cancelSubscription()/mySubscription() now just refuse/return empty;
  // will be rebuilt on PhonePe AutoPay once that's available.
  async subscribe(_userId: string, _ownerType: MarketingOwnerType) {
    throw new BadRequestException('Subscriptions are currently unavailable. Use one-time payments instead.');
  }

  async cancelSubscription(_userId: string, _ownerType: MarketingOwnerType) {
    throw new BadRequestException('Subscriptions are currently unavailable.');
  }

  async mySubscription(_userId: string, _ownerType: MarketingOwnerType) {
    return null;
  }

  /** Is this specific event currently covered by a paid marketing
   * arrangement — an active/completed one-time MarketingOrder for it. The
   * one gate the Analytics endpoint checks before calling into
   * AnalyticsReportService — see MarketingController. (Previously also
   * checked an active MarketingSubscription's current 30-day window —
   * removed alongside recurring billing, see subscribe() above.) */
  async isEventCovered(ownerType: MarketingOwnerType, ownerId: string, eventId: string): Promise<boolean> {
    const order = await this.prisma.marketingOrder.findFirst({
      where: {
        eventId,
        status: { in: ['active', 'expired'] }, // 'expired' = event has passed but was legitimately run
        ...(ownerType === 'organizer' ? { organizerId: ownerId } : { venueId: ownerId }),
      },
    });
    return !!order;
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
    return [];
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
