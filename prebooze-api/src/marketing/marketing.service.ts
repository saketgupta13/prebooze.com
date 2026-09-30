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
import { postIncome } from '../common/post-income';
import { OrgNotificationsService } from '../notifications/org-notifications';
import { MetaInsightsService } from '../meta/meta-insights.service';

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
    private orgNotifications: OrgNotificationsService,
    private metaInsights: MetaInsightsService,
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
  private toPublicOrder(row: { id: string; eventId: string | null; eventTitle: string | null; amount: number; gstPct: number | null; gstAmount: number | null; total: number | null; status: string; createdAt: Date; periodEnd: Date | null; rejectionReason?: string | null }) {
    return {
      id: row.id, eventId: row.eventId, eventTitle: row.eventTitle, amount: row.amount,
      gstPct: row.gstPct ?? 0, gstAmount: row.gstAmount ?? 0, total: row.total ?? row.amount, status: row.status,
      createdAt: row.createdAt,
      // A real 30-day-plan order (requestForPeriod) is exactly what
      // eventId: null already meant here — this used to be hardcoded false
      // because nothing ever created that shape before now.
      isSubscriptionPeriod: row.eventId === null, periodStart: row.eventId === null ? row.createdAt : null,
      periodEnd: row.periodEnd, rejectionReason: row.rejectionReason ?? null,
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
    if (existing) {
      // A still-genuinely-in-progress or already-paid order really does
      // block a second purchase. But a 'pending' order this old was created
      // the instant someone clicked Pay — before any payment happened — and
      // if they abandoned the PhonePe checkout (closed the tab, backed out,
      // payment failed) it would otherwise sit here forever with no way to
      // ever buy marketing for this event again, since nothing else ever
      // expires or cancels it. Self-heal it here instead of needing a
      // separate cron: re-check its real PhonePe state once it's stale
      // enough that a genuine checkout would have finished one way or the
      // other, and only then decide whether it's actually done or dead.
      const STALE_MS = 15 * 60 * 1000;
      const isStale = existing.status === 'pending' && Date.now() - existing.createdAt.getTime() > STALE_MS;
      if (!isStale) throw new BadRequestException('This event already has a marketing order in progress or active');

      const status = existing.phonepeMerchantOrderId ? await this.phonepe.getOrderStatus(existing.phonepeMerchantOrderId).catch(() => null) : null;
      if (status?.state === 'COMPLETED') throw new BadRequestException('This event already has a marketing order in progress or active');
      // Genuinely abandoned — never paid, and old enough that it's not still
      // in flight. Delete it so the event becomes purchasable again.
      await this.prisma.marketingOrder.delete({ where: { id: existing.id } });
    }

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

  /** A single, one-time purchase covering every event this owner runs over
   * the following 30 days — NOT a recurring subscription/mandate (real
   * PhonePe AutoPay support doesn't exist yet, and building on top of a
   * hand-rolled one would be its own separate, larger project — see this
   * repo's standing payment-migration plan). It just naturally stops at
   * periodEnd; buying the next month is a fresh, separate purchase, same as
   * this one. Reuses the exact same MarketingOrder row shape a per-event
   * purchase does — eventId: null + periodEnd is what the schema already
   * modeled this as (isEventCovered/analyticsForPeriod below read it the
   * same way). */
  async requestForPeriod(userId: string, ownerType: MarketingOwnerType) {
    const owner = await this.resolveOwner(userId, ownerType);
    const ownerId = this.ownerIdOf(ownerType, owner);

    const existing = await this.prisma.marketingOrder.findFirst({
      where: { eventId: null, status: { in: ['pending', 'active'] }, ...(ownerType === 'organizer' ? { organizerId: ownerId } : { venueId: ownerId }) },
    });
    if (existing) {
      const STALE_MS = 15 * 60 * 1000;
      const isStale = existing.status === 'pending' && Date.now() - existing.createdAt.getTime() > STALE_MS;
      if (!isStale) throw new BadRequestException('You already have a 30-day plan in progress or active');
      const status = existing.phonepeMerchantOrderId ? await this.phonepe.getOrderStatus(existing.phonepeMerchantOrderId).catch(() => null) : null;
      if (status?.state === 'COMPLETED') throw new BadRequestException('You already have a 30-day plan in progress or active');
      await this.prisma.marketingOrder.delete({ where: { id: existing.id } });
    }

    const rates = await this.rates();
    const amount = rates.monthly;
    const settings = await this.prisma.platformSettings.findUnique({ where: { id: 'main' } });
    const gstPct = settings?.gstEnabled ? (settings?.gstPct ?? 0) : 0;
    const gstAmount = Math.round((amount * gstPct) / 100);
    const total = amount + gstAmount;
    const periodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const row = await this.prisma.marketingOrder.create({
      data: {
        ownerType: ownerType as never,
        organizerId: ownerType === 'organizer' ? ownerId : undefined,
        venueId: ownerType === 'venue' ? ownerId : undefined,
        eventId: null, eventTitle: null, periodEnd,
        amount, marginPct: rates.marginPct, gstPct, gstAmount, total, status: 'pending',
      },
    });

    const returnPath = ownerType === 'organizer' ? '/organizer/marketing' : '/venue/hosting/marketing';
    const returnUrl = `${process.env.WEB_APP_URL || 'https://prebooze.com'}${returnPath}?phonepe_return=1&orderId=${encodeURIComponent(row.id)}`;
    const order = await this.phonepe.createOrder(row.id, total * 100, returnUrl);
    await this.prisma.marketingOrder.update({ where: { id: row.id }, data: { phonepeMerchantOrderId: row.id } });

    return { id: row.id, amount, gstPct, gstAmount, total, phonepeRedirectUrl: order.redirectUrl };
  }

  /** Called by the frontend right after it gives up retrying confirmPayment
   * on return from a PhonePe checkout (Marketing.tsx/VenueMarketing.tsx's
   * resume loop) — the whole point is to free up the event immediately
   * instead of making an abandoned/failed payment wait out the 15-minute
   * staleness window in requestForEvent() before it can be retried. Only
   * ever deletes a row that's genuinely still unpaid by PhonePe's own
   * real-time status — if the payment actually completed in the last few
   * seconds (a slow UPI collect finishing right as the frontend's retries
   * ran out), this finishes confirming it exactly like confirmPayment()
   * would, never discards a real payment just because the client gave up
   * watching for it. */
  async abandon(userId: string, ownerType: MarketingOwnerType, id: string) {
    const row = await this.prisma.marketingOrder.findUnique({ where: { id } });
    if (!row) return { deleted: true };
    const owner = await this.resolveOwner(userId, ownerType);
    const ownerId = this.ownerIdOf(ownerType, owner);
    if (row.ownerType !== ownerType || (ownerType === 'organizer' ? row.organizerId : row.venueId) !== ownerId) throw new ForbiddenException();
    if (row.paymentId) return this.toPublicOrder(row); // already paid — nothing to abandon

    const status = row.phonepeMerchantOrderId ? await this.phonepe.getOrderStatus(row.phonepeMerchantOrderId).catch(() => null) : null;
    if (status?.state === 'COMPLETED') return this.confirmPayment(userId, ownerType, id);

    await this.prisma.marketingOrder.delete({ where: { id } });
    return { deleted: true };
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

    // Real Prebooze income is only the margin — the rest of row.amount is
    // pass-through ad spend meant to actually get spent on the organizer/
    // venue's Meta campaign, never Prebooze's own revenue (see this
    // service's own doc comment on marginPct). GST goes to the same
    // "GST collected (payable)" bucket bookings already use — owed to the
    // government, not real income either. Both were previously never
    // posted anywhere at all, so this order's real profit was invisible in
    // every financial report since the feature launched.
    const margin = Math.round((row.amount * row.marginPct) / 100);
    await postIncome(this.prisma, {
      category: 'Marketing campaign margin', amount: margin, note: row.eventTitle ?? owner.brand, eventId: row.eventId,
    }).catch(() => {});
    await postIncome(this.prisma, {
      category: 'GST collected (payable)', amount: row.gstAmount ?? 0, note: row.eventTitle ?? owner.brand, eventId: row.eventId,
    }).catch(() => {});

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
  /** Returns the real MarketingOrder covering this event, or null — a
   * direct per-event order first, otherwise a 30-day-plan order (eventId:
   * null) whose window the event's own date falls inside. A plan only ever
   * covers events that exist/are scheduled while it's active, same
   * "currentStart/currentEnd" reasoning the old MarketingSubscription
   * design already used, just against this order's own createdAt/periodEnd
   * instead of a recurring mandate's billing cycle. */
  private async coveringOrder(ownerType: MarketingOwnerType, ownerId: string, eventId: string) {
    const ownerWhere = ownerType === 'organizer' ? { organizerId: ownerId } : { venueId: ownerId };
    const direct = await this.prisma.marketingOrder.findFirst({
      where: { eventId, status: { in: ['active', 'expired'] }, ...ownerWhere }, // 'expired' = event has passed but was legitimately run
    });
    if (direct) return direct;

    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { date: true } });
    if (!event) return null;
    return this.prisma.marketingOrder.findFirst({
      where: { eventId: null, status: { in: ['active', 'expired'] }, periodEnd: { gte: event.date }, createdAt: { lte: event.date }, ...ownerWhere },
    });
  }

  async isEventCovered(ownerType: MarketingOwnerType, ownerId: string, eventId: string): Promise<boolean> {
    return !!(await this.coveringOrder(ownerType, ownerId, eventId));
  }

  /** Real ad performance from Meta, non-monetary only — impressions/reach/
   * clicks/ctr, deliberately never spend. Showing spend would let an
   * organizer/venue back into Prebooze's real margin themselves (spend =
   * what they paid minus margin, and they already know what they paid),
   * which is exactly the number this whole product deliberately never
   * shows them (see MarketingOrder.marginPct's own doc comment). Null (the
   * section just doesn't render) if no campaign id is set yet or the Meta
   * call fails — never blocks the rest of the analytics page. */
  private async safeAdPerformance(metaCampaignId: string | null) {
    if (!metaCampaignId) return null;
    const insights = await this.metaInsights.getCombinedInsights(metaCampaignId);
    if (!insights) return null;
    return { impressions: insights.impressions, reach: insights.reach, clicks: insights.clicks, ctr: insights.ctr };
  }

  /** The "Analytics" screen's one data source — reuses
   * AnalyticsReportService.get() verbatim (the exact same aggregation admin
   * already sees) but gated on coveringOrder above and stripped down to a
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
    const order = await this.coveringOrder(ownerType, ownerId, eventId);
    if (!order) throw new ForbiddenException('No active marketing arrangement for this event');

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
      adPerformance: await this.safeAdPerformance(order.metaCampaignId),
      isPeriodCovered: order.eventId === null,
    };
  }

  /** Same shape as analyticsFor, but for a 30-day-plan order rather than one
   * specific event — aggregates the real on-site funnel across every event
   * this owner ran (or has scheduled) within [order.createdAt, periodEnd],
   * via AnalyticsReportService's new eventIds override, plus the combined
   * real Meta numbers across every campaign id behind the plan. */
  async analyticsForPeriod(userId: string, ownerType: MarketingOwnerType, orderId: string) {
    const owner = await this.resolveOwner(userId, ownerType);
    const ownerId = this.ownerIdOf(ownerType, owner);
    const order = await this.prisma.marketingOrder.findUnique({ where: { id: orderId } });
    if (!order) throw new NotFoundException('Marketing order not found');
    if (order.eventId !== null) throw new BadRequestException('This order is a per-event purchase, not a 30-day plan');
    if (order.ownerType !== ownerType || (ownerType === 'organizer' ? order.organizerId : order.venueId) !== ownerId) throw new ForbiddenException();
    if (!['active', 'expired'].includes(order.status)) throw new ForbiddenException('This plan is not active');

    const events = await this.prisma.event.findMany({
      where: {
        date: { gte: order.createdAt, lte: order.periodEnd ?? order.createdAt },
        ...(ownerType === 'organizer' ? { organizerId: ownerId } : { venueId: ownerId, hostedByVenue: true }),
      },
      select: { id: true, title: true },
    });
    const eventIds = events.map((e) => e.id);

    const full = eventIds.length > 0
      ? await this.analyticsReport.get({ eventIds })
      : { stages: [], totalEvents: 0, daily: [], devices: [], browsers: [], operatingSystems: [], trafficSources: [], campaigns: [], geographies: [], regions: [], adPlatforms: [], visitorType: [], heatmap: [], paymentFailures: [] };

    return {
      periodEnd: order.periodEnd, events: events.map((e) => ({ id: e.id, title: e.title })),
      stages: full.stages, totalEvents: full.totalEvents,
      daily: full.daily.map((d) => ({ date: d.date, viewed: d.viewed, completed: d.completed })),
      devices: full.devices, browsers: full.browsers, operatingSystems: full.operatingSystems,
      trafficSources: full.trafficSources, campaigns: full.campaigns, geographies: full.geographies,
      regions: full.regions, adPlatforms: full.adPlatforms, visitorType: full.visitorType,
      heatmap: full.heatmap, paymentFailures: full.paymentFailures,
      adPerformance: await this.safeAdPerformance(order.metaCampaignId),
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

  /** Real userId + contact details for whoever owns this order — the other
   * direction from resolveOwner() (that one needs the caller's own userId
   * to find their organizer/venue; this needs the reverse, given only the
   * order's organizerId/venueId, for the two admin-only methods below that
   * have no caller userId to start from). */
  private async resolveOwnerContact(row: { ownerType: MarketingOwnerType; organizerId: string | null; venueId: string | null }) {
    if (row.ownerType === 'organizer') {
      const org = row.organizerId ? await this.prisma.organizer.findUnique({ where: { id: row.organizerId } }) : null;
      if (!org?.userId) return null;
      const user = await this.prisma.user.findUnique({ where: { id: org.userId } });
      return user ? { userId: user.id, email: user.email, name: user.name } : null;
    }
    const venue = row.venueId ? await this.prisma.venue.findUnique({ where: { id: row.venueId } }) : null;
    if (!venue?.userId) return null;
    const user = await this.prisma.user.findUnique({ where: { id: venue.userId } });
    return user ? { userId: user.id, email: user.email, name: user.name } : null;
  }

  /** Admin-only reconciliation — real spend/impressions/reach/clicks from
   * Meta for this order's own campaign id(s), fetched fresh on every call
   * (see MetaInsightsService's own doc comment on why this is never
   * cached/persisted). Lets admin catch the assumed margin/ad-spend split
   * drifting from what actually got spent, without exposing real spend to
   * the organizer/venue themselves (see analyticsFor's adPerformance,
   * which deliberately strips spend for exactly that reason). */
  async adminRealPerformance(id: string) {
    const row = await this.prisma.marketingOrder.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Marketing order not found');
    if (!row.metaCampaignId) throw new BadRequestException('No Meta campaign id set on this order yet');
    const insights = await this.metaInsights.getCombinedInsights(row.metaCampaignId);
    if (!insights) throw new BadRequestException('Could not fetch real data from Meta — check the campaign id(s) are correct');
    const assumedMargin = Math.round((row.amount * row.marginPct) / 100);
    const assumedAdSpend = row.amount - assumedMargin;
    return { ...insights, assumedMargin, assumedAdSpend };
  }

  /** The human handoff point — admin has actually created the real Meta
   * campaign for this order/subscription and is recording its id + marking
   * it live. Requires the order to be paid first (mirrors
   * FeaturedService.adminApprove's "can't approve unpaid" rule). */
  async adminSetCampaign(id: string, metaCampaignId: string) {
    const row = await this.prisma.marketingOrder.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Marketing order not found');
    if (!row.paymentId) throw new BadRequestException('Cannot activate a marketing order that hasn’t been paid for yet');
    const updated = await this.prisma.marketingOrder.update({ where: { id }, data: { metaCampaignId, status: 'active' } });

    // Real notification the moment the campaign actually goes live — before
    // this, the organizer/venue had no way to find out except by refreshing
    // the Marketing page themselves.
    const owner = await this.resolveOwnerContact(row);
    if (owner) {
      if (owner.email) {
        await this.email.sendTemplate(owner.email, 'marketing_campaign_active', {
          name: owner.name, eventTitle: row.eventTitle ?? 'your campaign', eventId: row.eventId ?? '',
        }).catch(() => {});
      }
      if (row.ownerType === 'organizer') {
        await this.orgNotifications.notify(owner.userId, 'approved', `Your ad campaign for "${row.eventTitle ?? 'your event'}" is now live`, `/organizer/marketing/analytics?eventId=${encodeURIComponent(row.eventId ?? '')}`).catch(() => {});
      }
    }

    return updated;
  }

  async adminReject(id: string, reason?: string) {
    const row = await this.prisma.marketingOrder.findUnique({ where: { id } });
    if (!row) throw new NotFoundException('Marketing order not found');
    const updated = await this.prisma.marketingOrder.update({ where: { id }, data: { status: 'rejected', rejectionReason: reason ?? null } });

    const owner = await this.resolveOwnerContact(row);
    if (owner) {
      if (owner.email) {
        const reasonBlock = reason
          ? `<p style="background:rgba(255,107,94,.08);border:1px solid rgba(255,107,94,.25);border-radius:8px;padding:10px 12px;">${reason}</p>`
          : '';
        await this.email.sendTemplate(owner.email, 'marketing_rejected', {
          name: owner.name, eventTitle: row.eventTitle ?? 'your campaign', reasonBlock,
        }).catch(() => {});
      }
      if (row.ownerType === 'organizer') {
        await this.orgNotifications.notify(owner.userId, 'rejected', `Your marketing order for "${row.eventTitle ?? 'your event'}" was rejected${reason ? ` — ${reason}` : ''}`, '/organizer/marketing').catch(() => {});
      }
    }

    return updated;
  }
}
