import { Injectable } from '@nestjs/common';
import type { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';

// Statuses that still hold inventory / haven't had their revenue reversed —
// mirrors the same set BookingsService treats as "not yet given back" (see
// finalizeRefund vs. the refund_requested holding pattern).
const LIVE_BOOKING_STATUSES: BookingStatus[] = ['confirmed', 'refund_requested'];

export interface SettingsInput {
  bookingFee?: number;
  gstPct?: number;
  feeLabel?: string;
  absorbedBy?: string;
  payoutDay?: string;
  autoPayout?: boolean;
  weeklyEmail?: boolean;
  whatsappAlerts?: boolean;
  require2fa?: boolean;
  maintenanceMode?: boolean;
  salesPaused?: boolean;
  comingSoonMode?: boolean;
  socials?: Record<string, string>;
  siteSeo?: Record<string, string>;
  contact?: Record<string, string>;
  footerCopyright?: string;
  logoUrl?: string | null;
  faviconUrl?: string | null;
}

const SETTINGS_FIELDS: (keyof SettingsInput)[] = [
  'bookingFee', 'gstPct', 'feeLabel', 'absorbedBy', 'payoutDay', 'autoPayout',
  'weeklyEmail', 'whatsappAlerts', 'require2fa', 'maintenanceMode', 'salesPaused', 'comingSoonMode',
  'socials', 'siteSeo', 'contact', 'footerCopyright', 'logoUrl', 'faviconUrl',
];

@Injectable()
export class ReportsService {
  constructor(private prisma: PrismaService) {}

  async settings() {
    return this.prisma.platformSettings.upsert({
      where: { id: 'main' },
      update: {},
      create: { id: 'main' },
    });
  }

  async updateSettings(body: SettingsInput) {
    const data: Prisma.PlatformSettingsUpdateInput = {};
    for (const key of SETTINGS_FIELDS) {
      if (body[key] !== undefined) (data as Record<string, unknown>)[key] = body[key];
    }
    return this.prisma.platformSettings.upsert({
      where: { id: 'main' },
      update: data,
      create: { id: 'main', ...(data as Record<string, unknown>) },
    });
  }

  /** Shared by Finance.tsx (all-time, no `from`/`to`) and the Reports page's
   * Profit & loss / Balance sheet / Commission-by-event chips (date-ranged).
   * Revenue is recognized on the booking's own `createdAt` (when the sale
   * actually happened) rather than the event's date — the honest real-data
   * equivalent of what the old mock did by necessity (bucketing by event
   * date, since the mock had no per-sale timestamps at all). `city` filters
   * every number in the response, not just a top-events list, unlike the
   * old mock/pre-migration version of this method. */
  async finance(city?: string, from?: string, to?: string) {
    const settings = await this.settings();
    const dateWhere = dateRangeWhere(from, to);

    const events = await this.prisma.event.findMany({
      where: { status: { not: 'draft' } },
      select: { id: true, title: true, category: true, commission: true, paidOut: true, privateCity: true, venue: { select: { city: true } } },
    });
    const scopedEvents = city ? events.filter((e) => (e.venue?.city ?? e.privateCity) === city) : events;
    const scopedEventIds = new Set(scopedEvents.map((e) => e.id));

    const revenueByEvent = await this.prisma.booking.groupBy({
      by: ['eventId'],
      where: { status: { in: LIVE_BOOKING_STATUSES }, eventId: { in: [...scopedEventIds] }, createdAt: dateWhere },
      _sum: { subtotal: true, fee: true },
    });
    const revMap = new Map(revenueByEvent.map((r) => [r.eventId, { revenue: r._sum.subtotal ?? 0, fee: r._sum.fee ?? 0 }]));

    const enriched = scopedEvents.map((e) => ({
      id: e.id, title: e.title, category: e.category, commission: e.commission, paidOut: e.paidOut,
      city: e.venue?.city ?? e.privateCity ?? null,
      revenue: revMap.get(e.id)?.revenue ?? 0,
    }));
    const selling = enriched.filter((e) => e.commission != null && e.revenue > 0);

    const revenueByCategory = new Map<string, number>();
    for (const e of enriched) if (e.revenue > 0) revenueByCategory.set(e.category, (revenueByCategory.get(e.category) ?? 0) + e.revenue);

    const commissionIncome = Math.round(selling.reduce((a, e) => a + (e.revenue * (e.commission as number)) / 100, 0));
    const feeIncome = revenueByEvent.reduce((a, r) => a + (r._sum.fee ?? 0), 0);
    // "Ticket commission" and "Booking fees" are excluded here — they're
    // the exact same real activity as commissionIncome/feeIncome above,
    // just also mirrored into the ledger table (BookingsService.
    // postEventLedger) so Finance.tsx has real auto-posted rows to show.
    // Summing them again here would double-count every real sale.
    // Ledger has no per-event city, so "other income"/expenses only ever
    // appear in the All-cities view — same convention the old mock used,
    // now enforced server-side rather than in the frontend's useMemo.
    const otherIncome = city
      ? 0
      : (
          await this.prisma.ledgerEntry.aggregate({
            where: { kind: 'income', category: { notIn: ['Ticket commission', 'Booking fees'] }, createdAt: dateWhere },
            _sum: { amount: true },
          })
        )._sum.amount ?? 0;

    const expensesByCat: Record<string, number> = {};
    let totalExpenses = 0;
    if (!city) {
      const expenseRows = await this.prisma.ledgerEntry.findMany({ where: { kind: 'expense', createdAt: dateWhere } });
      for (const row of expenseRows) expensesByCat[row.category] = (expensesByCat[row.category] ?? 0) + row.amount;
      totalExpenses = Object.values(expensesByCat).reduce((a, v) => a + v, 0);
    }

    const gstPayable = Math.round((feeIncome * settings.gstPct) / 100);
    const gross = selling.reduce((a, e) => a + e.revenue, 0);
    const payoutsDue = Math.round(selling.filter((e) => !e.paidOut).reduce((a, e) => a + (e.revenue - (e.revenue * (e.commission as number)) / 100), 0));
    const paidOut = Math.round(selling.filter((e) => e.paidOut).reduce((a, e) => a + (e.revenue - (e.revenue * (e.commission as number)) / 100), 0));
    const totalIncome = commissionIncome + feeIncome + otherIncome;
    const netProfit = totalIncome - totalExpenses - gstPayable;
    const cash = gross + otherIncome - paidOut - totalExpenses;

    const refundsPendingAgg = await this.prisma.booking.aggregate({
      where: { status: 'refund_requested', eventId: { in: [...scopedEventIds] }, createdAt: dateWhere },
      _sum: { total: true },
    });
    const refundsPending = refundsPendingAgg._sum.total ?? 0;

    const sellingEvents = [...selling]
      .sort((a, b) => b.revenue - a.revenue)
      .map((e) => ({ id: e.id, title: e.title, city: e.city, revenue: e.revenue, commission: e.commission as number, commissionAmt: Math.round((e.revenue * (e.commission as number)) / 100), paidOut: e.paidOut }));

    return {
      commissionIncome, feeIncome, otherIncome, expensesByCat, totalExpenses, gstPayable,
      gross, payoutsDue, paidOut, totalIncome, netProfit, cash, refundsPending, sellingEvents,
      revenueByCategory: Object.fromEntries(revenueByCategory),
      settings: { bookingFee: settings.bookingFee, gstPct: settings.gstPct },
    };
  }

  /** Sales/GST tabs' daily line charts — gross sales, commission, booking
   * fees and the GST payable on those fees, bucketed by the calendar day
   * each booking was actually made (see finance()'s comment on why
   * `createdAt`, not the event's date, is the honest real-data choice).
   * Capped implicitly by the caller's own date-picker range; this just
   * walks day-by-day between `from`/`to` rather than pre-aggregating in SQL
   * — the report windows this page supports (weeks/months, not years) keep
   * that array small enough that a single grouped query + in-memory bucket
   * is simpler than a raw date_trunc query, and stays correct across
   * timezones without needing Postgres's session tz to match the browser's. */
  async daily(city?: string, from?: string, to?: string) {
    const settings = await this.settings();
    const events = city
      ? await this.prisma.event.findMany({ where: { OR: [{ venue: { city } }, { privateCity: city }] }, select: { id: true } })
      : null;
    const rows = await this.prisma.booking.findMany({
      where: {
        status: { in: LIVE_BOOKING_STATUSES },
        createdAt: dateRangeWhere(from, to),
        ...(events ? { eventId: { in: events.map((e) => e.id) } } : {}),
      },
      select: { subtotal: true, fee: true, createdAt: true, event: { select: { commission: true } } },
    });

    const byDay = new Map<string, { grossSales: number; commission: number; bookingFees: number }>();
    for (const r of rows) {
      const key = r.createdAt.toISOString().slice(0, 10);
      const cur = byDay.get(key) ?? { grossSales: 0, commission: 0, bookingFees: 0 };
      cur.grossSales += r.subtotal;
      cur.commission += r.event.commission != null ? (r.subtotal * r.event.commission) / 100 : 0;
      cur.bookingFees += r.fee;
      byDay.set(key, cur);
    }

    return [...byDay.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, v]) => ({
        date,
        grossSales: Math.round(v.grossSales),
        commission: Math.round(v.commission),
        bookingFees: Math.round(v.bookingFees),
        gstPayable: Math.round((v.bookingFees * settings.gstPct) / 100),
      }));
  }

  /** Refunds tab — real requested/completed refunds in range, scoped by
   * `Booking.createdAt` (the original sale date; there's no separate
   * refund-completion timestamp on Booking today, so a refund granted in a
   * later period than its purchase won't surface in that later period's
   * window — a real gap, not silently papered over, worth a schema addition
   * if this ever needs to be date-of-refund accurate). */
  async refunds(city?: string, from?: string, to?: string) {
    const events = city
      ? await this.prisma.event.findMany({ where: { OR: [{ venue: { city } }, { privateCity: city }] }, select: { id: true } })
      : null;
    const scopeWhere = events ? { eventId: { in: events.map((e) => e.id) } } : {};
    const dateWhere = dateRangeWhere(from, to);

    const [totalCount, rows] = await Promise.all([
      this.prisma.booking.count({ where: { ...scopeWhere, createdAt: dateWhere } }),
      this.prisma.booking.findMany({
        where: { ...scopeWhere, createdAt: dateWhere, status: { in: ['refund_requested', 'refunded'] } },
        select: { id: true, mainGuest: true, total: true, status: true, createdAt: true, event: { select: { title: true } } },
        orderBy: { createdAt: 'desc' },
      }),
    ]);

    const requested = rows.filter((r) => r.status === 'refund_requested');
    const refunded = rows.filter((r) => r.status === 'refunded');
    const refundedValue = refunded.reduce((a, r) => a + r.total, 0);

    return {
      requestedCount: requested.length,
      refundedCount: refunded.length,
      refundedValue,
      refundRate: totalCount ? Math.round((rows.length / totalCount) * 100) : 0,
      rows: rows.map((r) => ({ id: r.id, guest: r.mainGuest, eventTitle: r.event.title, amount: r.total, status: r.status })),
    };
  }

  /** Attendance tab — per-guest check-in granularity (each booking's
   * `guests` array, same source BookingDetail's per-guest "Checked in" tags
   * use), not the booking-level `checkedIn` flag — that flag only means
   * "this QR was scanned at least once," so counting it as if the whole
   * group's qty checked in would overstate turnout on any partially-scanned
   * group booking. Only `LIVE_BOOKING_STATUSES` count as "sold" — same set
   * finance()'s P&L uses — a `refunded` booking gave its seat back and
   * shouldn't inflate sold/turnout, unlike `refund_requested` which hasn't
   * actually reversed anything yet. */
  async attendance(city?: string, from?: string, to?: string) {
    const events = city
      ? await this.prisma.event.findMany({ where: { OR: [{ venue: { city } }, { privateCity: city }] }, select: { id: true } })
      : null;
    const rows = await this.prisma.booking.findMany({
      where: {
        status: { in: LIVE_BOOKING_STATUSES },
        createdAt: dateRangeWhere(from, to),
        ...(events ? { eventId: { in: events.map((e) => e.id) } } : {}),
      },
      select: { eventId: true, qty: true, guests: true, event: { select: { title: true } } },
    });

    const byEvent = new Map<string, { title: string; sold: number; checkedIn: number }>();
    let totalSold = 0;
    let totalCheckedIn = 0;
    for (const r of rows) {
      const guestList = Array.isArray(r.guests) ? (r.guests as { checkedIn?: boolean }[]) : [];
      const checkedIn = guestList.filter((g) => g.checkedIn).length;
      totalSold += r.qty;
      totalCheckedIn += checkedIn;
      const cur = byEvent.get(r.eventId) ?? { title: r.event.title, sold: 0, checkedIn: 0 };
      cur.sold += r.qty;
      cur.checkedIn += checkedIn;
      byEvent.set(r.eventId, cur);
    }

    return {
      sold: totalSold,
      checkedIn: totalCheckedIn,
      turnoutRate: totalSold ? Math.round((totalCheckedIn / totalSold) * 100) : 0,
      rows: [...byEvent.entries()].map(([id, v]) => ({ id, ...v })).sort((a, b) => b.sold - a.sold),
    };
  }
}

/** `to` from an HTML date input is a bare `YYYY-MM-DD` — treated as UTC
 * midnight by `new Date()`, which would silently exclude every sale made
 * later that same day. Bumped to the last instant of that day so the
 * selected end date is fully inclusive, same as the old mock's
 * `${to}T23:59:59` convention. */
function dateRangeWhere(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: new Date(from) } : {}),
    // Explicit `Z` — a bare `T23:59:59.999` (no zone) parses as the
    // server's *local* time, not UTC. On an IST server that silently
    // clips the last ~5.5 hours of the selected day off the query, which
    // is exactly wide enough to exclude same-day sales for anyone booking
    // in the evening IST (most of Prebooze's real traffic). `timestamp
    // without time zone` columns are stored/read as naive-but-UTC-labeled
    // by Prisma (Postgres itself just holds whatever wall-clock value the
    // writing session had — see BookingsService et al., all written under
    // Asia/Kolkata), so the filter boundary needs the same explicit UTC
    // labeling to actually line up with what's in the column.
    ...(to ? { lte: new Date(`${to}T23:59:59.999Z`) } : {}),
  };
}
