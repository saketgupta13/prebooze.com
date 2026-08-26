import { Injectable } from '@nestjs/common';
import type { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { ReportsService } from './reports.service';
import { leadPhoneKeySet, phoneKey } from './lead-phone-match.util';
import { istDateKey } from '../common/ist-date';

const LIVE_BOOKING_STATUSES: BookingStatus[] = ['confirmed', 'refund_requested'];

interface PromoterConfig {
  enabled: boolean;
  perHeadPayout: boolean;
  perHeadAmount: number;
}

/** The mock's Dashboard.tsx mixes genuinely-computable KPIs (pending
 * queues, totals, top events/promoters) with hardcoded display padding
 * (₹4.2L, "+2140" added to real counts, a canned sales-trend array per date
 * range) to make an empty dev dataset look populated. This service computes
 * everything for real and drops the padding — on a fresh/small seed dataset
 * these numbers will legitimately look sparse, which is honest, not broken. */
@Injectable()
export class DashboardService {
  constructor(
    private prisma: PrismaService,
    private reports: ReportsService,
  ) {}

  /** Same guest definition + lead exclusion as CustomersService.list — kept
   * here as a small standalone count rather than importing CustomersService
   * itself, since a `count()` doesn't need the booking-stats join that
   * service's full list does. */
  private async countRealCustomers(): Promise<number> {
    const guests = await this.prisma.user.findMany({ where: { role: null, roleStatus: null }, select: { phone: true } });
    if (!guests.length) return 0;
    const leadPhones = await leadPhoneKeySet(this.prisma);
    if (!leadPhones.size) return guests.length;
    return guests.filter((u) => !leadPhones.has(phoneKey(u.phone))).length;
  }

  async overview(days = 14, city?: string) {
    const now = new Date();
    const since = new Date(now.getTime() - days * 86400000);

    const [grossAgg, refundedAgg, finance] = await Promise.all([
      this.prisma.booking.aggregate({ where: { status: { in: LIVE_BOOKING_STATUSES } }, _sum: { subtotal: true, qty: true } }),
      this.prisma.booking.aggregate({ where: { status: 'refunded' }, _sum: { total: true, qty: true } }),
      this.reports.finance(),
    ]);

    const [pendingEvents, pendingRefunds, pendingKyc, totalCustomers, totalOrganizers, verifiedOrganizers, totalEvents, totalBookings] = await Promise.all([
      this.prisma.event.count({ where: { status: 'pending' } }),
      this.prisma.booking.count({ where: { status: 'refund_requested' } }),
      this.prisma.kycSubmission.count({ where: { status: 'pending' } }),
      // Every role (organizer/promoter/lineup/venue) shares the same User
      // table as guests — counting all Users here silently folded business
      // accounts into "customers". Same "guest" definition CustomersService
      // already uses for its "guests" segment: role and roleStatus both
      // null, *and* not already tracked as a Lead (a prospect being sold to
      // shouldn't inflate the customer count just because they haven't
      // formally applied yet — see CustomersService.list for the same logic).
      this.countRealCustomers(),
      this.prisma.organizer.count(),
      this.prisma.organizer.count({ where: { verified: true } }),
      this.prisma.event.count(),
      this.prisma.booking.count(),
    ]);

    const approvedEvents = await this.prisma.event.findMany({ where: { status: 'approved' }, select: { id: true, date: true, durationHrs: true } });
    const liveNow = approvedEvents.filter((e) => e.date <= now && new Date(e.date.getTime() + e.durationHrs * 3600000) >= now).length;

    // ---- top selling events (by tickets sold), optionally city-filtered ----
    const events = await this.prisma.event.findMany({
      where: { status: { not: 'draft' } },
      select: { id: true, title: true, privateCity: true, venue: { select: { city: true } } },
    });
    const eventCity = (e: (typeof events)[number]) => e.venue?.city ?? e.privateCity ?? '';
    const soldByEvent = await this.prisma.booking.groupBy({ by: ['eventId'], where: { status: { in: LIVE_BOOKING_STATUSES } }, _sum: { qty: true } });
    const soldMap = new Map(soldByEvent.map((r) => [r.eventId, r._sum.qty ?? 0]));
    const pool = city ? events.filter((e) => eventCity(e) === city) : events;
    const topSellingEvents = pool
      .map((e) => ({ id: e.id, title: e.title, city: eventCity(e), sold: soldMap.get(e.id) ?? 0 }))
      .filter((e) => e.sold > 0)
      .sort((a, b) => b.sold - a.sold)
      .slice(0, 5);

    // ---- ticket statistics ----
    const tierAgg = await this.prisma.ticketTier.aggregate({ where: { event: { status: { not: 'draft' } } }, _sum: { quantity: true, sold: true } });
    const checkedInAgg = await this.prisma.booking.aggregate({ where: { status: 'confirmed', checkedIn: true }, _sum: { qty: true } });
    const cap = tierAgg._sum.quantity ?? 0;
    const sold = tierAgg._sum.sold ?? 0;

    // ---- top promoters (commission-only ranking — see BACKEND.md) ----
    const promoters = await this.prisma.promoter.findMany({ select: { id: true, name: true, slug: true, showRate: true } });
    const arrivedGuests = await this.prisma.promoterGuest.findMany({ where: { arrived: true }, select: { promoterSlug: true, event: { select: { promoterConfig: true } } } });
    const perHeadBySlug = new Map<string, number>();
    for (const g of arrivedGuests) {
      const cfg = g.event.promoterConfig as unknown as PromoterConfig | null;
      if (!cfg?.enabled || !cfg.perHeadPayout) continue;
      perHeadBySlug.set(g.promoterSlug, (perHeadBySlug.get(g.promoterSlug) ?? 0) + cfg.perHeadAmount);
    }
    const commissionByRef = await this.prisma.booking.groupBy({ by: ['promoterRef'], where: { promoterRef: { not: null }, status: { not: 'cancelled' } }, _sum: { promoterCommission: true } });
    const commissionBySlug = new Map(commissionByRef.map((r) => [r.promoterRef as string, r._sum.promoterCommission ?? 0]));
    const topPromoters = promoters
      .map((p) => ({ id: p.id, name: p.name, showRate: p.showRate, earned: (perHeadBySlug.get(p.slug) ?? 0) + (commissionBySlug.get(p.slug) ?? 0) }))
      .filter((p) => p.earned > 0)
      .sort((a, b) => b.earned - a.earned)
      .slice(0, 3);

    // ---- sales trend (real daily gross, replacing the mock's canned arrays) ----
    const recentBookings = await this.prisma.booking.findMany({
      where: { status: { in: LIVE_BOOKING_STATUSES }, createdAt: { gte: since } },
      select: { subtotal: true, createdAt: true },
    });
    const trend: { date: string; gross: number }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const day = new Date(now.getTime() - i * 86400000);
      const key = istDateKey(day);
      trend.push({ date: key, gross: 0 });
    }
    const trendIndex = new Map(trend.map((t, i) => [t.date, i]));
    for (const b of recentBookings) {
      const key = istDateKey(b.createdAt);
      const i = trendIndex.get(key);
      if (i !== undefined) trend[i].gross += b.subtotal;
    }

    // ---- live & upcoming events ----
    const upcoming = await this.prisma.event.findMany({
      where: { status: { in: ['approved', 'pending'] } },
      orderBy: { date: 'asc' },
      take: 5,
      select: { id: true, title: true, date: true, status: true },
    });
    const upcomingRevenue = await this.prisma.booking.groupBy({
      by: ['eventId'],
      where: { eventId: { in: upcoming.map((e) => e.id) }, status: { in: LIVE_BOOKING_STATUSES } },
      _sum: { subtotal: true, qty: true },
    });
    const upcomingMap = new Map(upcomingRevenue.map((r) => [r.eventId, { revenue: r._sum.subtotal ?? 0, sold: r._sum.qty ?? 0 }]));
    const liveAndUpcoming = upcoming.map((e) => ({ id: e.id, title: e.title, date: e.date, status: e.status, ...(upcomingMap.get(e.id) ?? { revenue: 0, sold: 0 }) }));

    return {
      grossSales: grossAgg._sum.subtotal ?? 0,
      ticketsSold: grossAgg._sum.qty ?? 0,
      commissionEarned: finance.commissionIncome,
      refundsAmount: refundedAgg._sum.total ?? 0,
      refundedTickets: refundedAgg._sum.qty ?? 0,
      pendingEvents,
      pendingRefunds,
      pendingKyc,
      totalCustomers,
      totalOrganizers,
      verifiedOrganizers,
      totalEvents,
      liveNow,
      totalBookings,
      topSellingEvents,
      ticketStats: { sold, available: Math.max(0, cap - sold), checkedIn: checkedInAgg._sum.qty ?? 0, refunded: refundedAgg._sum.qty ?? 0, cap },
      topPromoters,
      salesTrend: trend,
      liveAndUpcoming,
    };
  }
}
