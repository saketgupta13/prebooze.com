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

  /** The Reports page's Profit & loss / Balance sheet chips — the only two
   * chips in the mock backed by real computed numbers; the rest (Sales,
   * Commission by event, GST/tax, Refunds, Attendance, Promos) render the
   * same static placeholder chart divs regardless of which is selected, so
   * nothing else needs a query. `city` only filters `topEvents`, matching
   * the mock exactly (its `fin` useMemo never depends on the city filter). */
  async finance(city?: string) {
    const settings = await this.settings();

    const events = await this.prisma.event.findMany({
      where: { status: { not: 'draft' } },
      select: { id: true, title: true, commission: true, paidOut: true, venue: { select: { city: true } } },
    });

    const revenueByEvent = await this.prisma.booking.groupBy({
      by: ['eventId'],
      where: { status: { in: LIVE_BOOKING_STATUSES } },
      _sum: { subtotal: true, fee: true },
    });
    const revMap = new Map(revenueByEvent.map((r) => [r.eventId, { revenue: r._sum.subtotal ?? 0, fee: r._sum.fee ?? 0 }]));

    const enriched = events.map((e) => ({ ...e, revenue: revMap.get(e.id)?.revenue ?? 0 }));
    const selling = enriched.filter((e) => e.commission != null && e.revenue > 0);

    const commissionIncome = Math.round(selling.reduce((a, e) => a + (e.revenue * (e.commission as number)) / 100, 0));
    const feeIncome = revenueByEvent.reduce((a, r) => a + (r._sum.fee ?? 0), 0);
    const otherIncomeAgg = await this.prisma.ledgerEntry.aggregate({ where: { kind: 'income' }, _sum: { amount: true } });
    const otherIncome = otherIncomeAgg._sum.amount ?? 0;

    const expenseRows = await this.prisma.ledgerEntry.findMany({ where: { kind: 'expense' } });
    const expensesByCat: Record<string, number> = {};
    for (const row of expenseRows) expensesByCat[row.category] = (expensesByCat[row.category] ?? 0) + row.amount;
    const totalExpenses = Object.values(expensesByCat).reduce((a, v) => a + v, 0);

    const gstPayable = Math.round((feeIncome * settings.gstPct) / 100);
    const gross = selling.reduce((a, e) => a + e.revenue, 0);
    const payoutsDue = Math.round(selling.filter((e) => !e.paidOut).reduce((a, e) => a + (e.revenue - (e.revenue * (e.commission as number)) / 100), 0));
    const paidOut = Math.round(selling.filter((e) => e.paidOut).reduce((a, e) => a + (e.revenue - (e.revenue * (e.commission as number)) / 100), 0));
    const totalIncome = commissionIncome + feeIncome + otherIncome;
    const netProfit = totalIncome - totalExpenses - gstPayable;
    const cash = gross + otherIncome - paidOut - totalExpenses;

    const refundsPendingAgg = await this.prisma.booking.aggregate({ where: { status: 'refund_requested' }, _sum: { total: true } });
    const refundsPending = refundsPendingAgg._sum.total ?? 0;

    const topPool = city ? enriched.filter((e) => e.venue.city === city) : enriched;
    const topEvents = [...topPool]
      .filter((e) => e.revenue > 0)
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 3)
      .map((e) => ({ id: e.id, title: e.title, revenue: e.revenue, commission: e.commission }));

    return {
      commissionIncome, feeIncome, otherIncome, expensesByCat, totalExpenses, gstPayable,
      gross, payoutsDue, paidOut, totalIncome, netProfit, cash, refundsPending, topEvents,
      settings: { bookingFee: settings.bookingFee, gstPct: settings.gstPct },
    };
  }
}
