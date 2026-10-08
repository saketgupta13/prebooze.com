import { Injectable } from '@nestjs/common';
import type { BookingStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { istDateKey, istDayStart, istDayEnd } from '../common/ist-date';
import { PREBOOZE_GST_STATE } from '../common/gst';

// Statuses that still hold inventory / haven't had their revenue reversed —
// mirrors the same set BookingsService treats as "not yet given back" (see
// finalizeRefund vs. the refund_requested holding pattern).
const LIVE_BOOKING_STATUSES: BookingStatus[] = ['confirmed', 'refund_requested'];

export interface SettingsInput {
  bookingFee?: number;
  gstPct?: number;
  gstEnabled?: boolean;
  gstin?: string | null;
  // Prebooze's own commission income (Event.commission%, deducted from an
  // organizer/venue's payout) is a real taxable B2B supply — see
  // common/payout-breakdown.ts's own doc comment for why this gets its own
  // rate field rather than reusing gstPct, even though both often land on
  // 18%. Takes effect only once gstEnabled is also true.
  commissionGstPct?: number;
  // TCS (GST Act s.52) — stays off until a real registration exists in
  // every state an event happens in; see PlatformSettings.tcsEnabled's own
  // schema comment.
  tcsEnabled?: boolean;
  tcsPct?: number;
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
  'bookingFee', 'gstPct', 'gstEnabled', 'gstin', 'commissionGstPct', 'tcsEnabled', 'tcsPct', 'feeLabel', 'absorbedBy', 'payoutDay', 'autoPayout',
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
      select: { id: true, title: true, category: true, commission: true, paidOut: true, privateCity: true, organizerId: true, venue: { select: { city: true } } },
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
      // Prebooze's own in-house events (organizer "prebooze-originals") —
      // kept at 0% commission in Event.commission itself (self-dealing, no
      // real payout owed — see adminApprove's own comment), but that same
      // 0% would also make the P&L treat its full ticket revenue as
      // nobody's income at all. There's no external organizer here: the
      // whole ticket revenue genuinely IS Prebooze's own money, so it's
      // counted as 100% commission for every calculation below (income,
      // payouts due/paid) without touching the real stored Event.commission
      // value other code (BookingsService's ledger crediting) still reads.
      effectiveCommission: e.organizerId === 'prebooze-originals' ? 100 : e.commission,
    }));
    const selling = enriched.filter((e) => e.effectiveCommission != null && e.revenue > 0);

    const revenueByCategory = new Map<string, number>();
    for (const e of enriched) if (e.revenue > 0) revenueByCategory.set(e.category, (revenueByCategory.get(e.category) ?? 0) + e.revenue);

    const commissionIncome = Math.round(selling.reduce((a, e) => a + (e.revenue * (e.effectiveCommission as number)) / 100, 0));
    const feeIncome = revenueByEvent.reduce((a, r) => a + (r._sum.fee ?? 0), 0);
    // "Ticket commission" and "Booking fees" are excluded here — they're
    // the exact same real activity as commissionIncome/feeIncome above,
    // just also mirrored into the ledger table (BookingsService.
    // postEventLedger) so Finance.tsx has real auto-posted rows to show.
    // Summing them again here would double-count every real sale.
    // LedgerEntry has no city column of its own, but every auto-posted row
    // does carry the eventId it came from — scope through that via the same
    // scopedEventIds a city filter already computes above. Real gap fixed
    // 2026-08-28: a city-scoped report used to always show ₹0 for every
    // expense/other-income category, city filter or not, because this used
    // to skip the query entirely whenever `city` was set. A manual entry
    // with no eventId (e.g. a platform-wide expense an admin typed in
    // directly) still only ever shows in the All-cities view — there's
    // nothing to scope it by.
    const ledgerEventFilter = city ? { eventId: { in: [...scopedEventIds] } } : {};

    // Neither "Commission GST (payable)" nor "TCS collected (held for
    // payee)" (2026-10-02) are ever real Prebooze income — the first is
    // owed to the government on the next GST return (same reasoning as
    // "GST collected (payable)"), the second isn't even Prebooze's money at
    // all (held under the payee's own GSTIN). Both excluded here the same
    // way.
    const NON_INCOME_CATEGORIES = ['Ticket commission', 'Booking fees', 'GST collected (payable)', 'Commission GST (payable)', 'TCS collected (held for payee)', 'Ad spend held for campaign (payable)'];
    const otherIncome = (
      await this.prisma.ledgerEntry.aggregate({
        where: { kind: 'income', category: { notIn: NON_INCOME_CATEGORIES }, createdAt: dateWhere, ...ledgerEventFilter },
        _sum: { amount: true },
      })
    )._sum.amount ?? 0;

    // Real GST collected on guests'/payees' behalf (real GSTIN activated
    // 2026-09-21; commission GST + TCS added 2026-10-02) — kept out of
    // otherIncome/totalIncome/netProfit deliberately: owed to the
    // government (or to the payee's own GSTIN, for TCS) on the next return,
    // never real Prebooze revenue, same reasoning as each one's own
    // postEventLedger call site. Still counted into `cash` below since it's
    // real money currently sitting in the account, just earmarked rather
    // than free to spend. TCS specifically needs this too — Prebooze
    // physically holds that cash until it's deposited under the payee's
    // GSTIN via GSTR-8, same as any other GST collected on someone else's
    // behalf.
    const gstCollected = (
      await this.prisma.ledgerEntry.aggregate({
        where: { kind: 'income', category: { in: ['GST collected (payable)', 'Commission GST (payable)', 'TCS collected (held for payee)'] }, createdAt: dateWhere, ...ledgerEventFilter },
        _sum: { amount: true },
      })
    )._sum.amount ?? 0;

    // Same "real money held, not free cash, not Prebooze income" shape as
    // gstCollected above, kept as its own field rather than folded in
    // there — this isn't tax, it's pass-through ad-spend an organizer/
    // venue paid for (MarketingService.confirmPayment), and the P&L's GST
    // line would mislabel it if merged. Never decremented when a campaign
    // activates and the money actually gets spent on Meta — see
    // confirmPayment's own comment for why; Admin's Marketing page shows
    // the live held-vs-in-use split off MarketingOrder.status instead.
    const adSpendHeld = (
      await this.prisma.ledgerEntry.aggregate({
        where: { kind: 'income', category: 'Ad spend held for campaign (payable)', createdAt: dateWhere, ...ledgerEventFilter },
        _sum: { amount: true },
      })
    )._sum.amount ?? 0;

    const expensesByCat: Record<string, number> = {};
    const expenseRows = await this.prisma.ledgerEntry.findMany({ where: { kind: 'expense', createdAt: dateWhere, ...ledgerEventFilter } });
    for (const row of expenseRows) expensesByCat[row.category] = (expensesByCat[row.category] ?? 0) + row.amount;
    const totalExpenses = Object.values(expensesByCat).reduce((a, v) => a + v, 0);

    const gross = selling.reduce((a, e) => a + e.revenue, 0);
    const payoutsDue = Math.round(selling.filter((e) => !e.paidOut).reduce((a, e) => a + (e.revenue - (e.revenue * (e.effectiveCommission as number)) / 100), 0));
    const paidOut = Math.round(selling.filter((e) => e.paidOut).reduce((a, e) => a + (e.revenue - (e.revenue * (e.effectiveCommission as number)) / 100), 0));
    const totalIncome = commissionIncome + feeIncome + otherIncome;
    const netProfit = totalIncome - totalExpenses;
    const cash = gross + otherIncome + gstCollected + adSpendHeld - paidOut - totalExpenses;

    const refundsPendingAgg = await this.prisma.booking.aggregate({
      where: { status: 'refund_requested', eventId: { in: [...scopedEventIds] }, createdAt: dateWhere },
      _sum: { total: true },
    });
    const refundsPending = refundsPendingAgg._sum.total ?? 0;

    const sellingEvents = [...selling]
      .sort((a, b) => b.revenue - a.revenue)
      .map((e) => ({ id: e.id, title: e.title, city: e.city, revenue: e.revenue, commission: e.effectiveCommission as number, commissionAmt: Math.round((e.revenue * (e.effectiveCommission as number)) / 100), paidOut: e.paidOut }));

    return {
      commissionIncome, feeIncome, otherIncome, gstCollected, adSpendHeld, expensesByCat, totalExpenses,
      gross, payoutsDue, paidOut, totalIncome, netProfit, cash, refundsPending, sellingEvents,
      revenueByCategory: Object.fromEntries(revenueByCategory),
      settings: { bookingFee: settings.bookingFee },
    };
  }

  /** Sales/GST tabs' daily line charts — gross sales, commission, booking
   * fees, bucketed by the calendar day each booking was actually made (see
   * finance()'s comment on why `createdAt`, not the event's date, is the
   * honest real-data choice). Capped implicitly by the caller's own
   * date-picker range; this just walks day-by-day between `from`/`to`
   * rather than pre-aggregating in SQL — the report windows this page
   * supports (weeks/months, not years) keep that array small enough that a
   * single grouped query + in-memory bucket is simpler than a raw
   * date_trunc query, and stays correct across timezones without needing
   * Postgres's session tz to match the browser's. */
  async daily(city?: string, from?: string, to?: string) {
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
      const key = istDateKey(r.createdAt);
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

  private monthRange(month: string): { from: string; to: string } {
    const [y, m] = month.split('-').map(Number);
    const lastDay = new Date(y, m, 0).getDate(); // plain JS date math — only used to find how many days the month has
    return { from: `${month}-01`, to: `${month}-${String(lastDay).padStart(2, '0')}` };
  }

  /** Real monthly GST output report — single source of truth is the Invoice
   * table, which already carries real CGST/SGST/IGST splits for every
   * GST-bearing flow (booking fee, Prebooze's own commission, Featured,
   * Marketing). Built for handing straight to a CA on the 1st of the month:
   * a per-source summary plus the real invoice-level rows behind it.
   * Booking-type invoices' taxable value is `fee` (the booking fee), not
   * `subtotal` (the ticket price, which carries no GST of its own) — every
   * other type's taxable value is `subtotal` directly. See each service's
   * own invoices.create() call for why. */
  async gst(month: string) {
    const { from, to } = this.monthRange(month);
    const invoices = await this.prisma.invoice.findMany({
      where: { issuedAt: dateRangeWhere(from, to), status: 'issued', type: { in: ['booking', 'commission', 'featured', 'marketing'] } },
      orderBy: { issuedAt: 'asc' },
    });

    const taxableOf = (inv: (typeof invoices)[number]) => (inv.type === 'booking' ? inv.fee : inv.subtotal);
    const label: Record<string, string> = {
      booking: 'Booking fees (from guests)', commission: 'Prebooze commission',
      featured: 'Featured placements', marketing: 'Marketing campaigns',
    };

    const bySource = new Map<string, { count: number; taxableValue: number; cgst: number; sgst: number; igst: number }>();
    for (const inv of invoices) {
      const cur = bySource.get(inv.type) ?? { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
      cur.count += 1;
      cur.taxableValue += taxableOf(inv);
      if (inv.igstAmount > 0) cur.igst += inv.igstAmount;
      else { cur.cgst += inv.gstAmount / 2; cur.sgst += inv.gstAmount / 2; }
      bySource.set(inv.type, cur);
    }

    const sources = (['booking', 'commission', 'featured', 'marketing'] as const).map((type) => {
      const v = bySource.get(type) ?? { count: 0, taxableValue: 0, cgst: 0, sgst: 0, igst: 0 };
      return {
        type, label: label[type], count: v.count, taxableValue: Math.round(v.taxableValue),
        cgst: Math.round(v.cgst), sgst: Math.round(v.sgst), igst: Math.round(v.igst),
        gstTotal: Math.round(v.cgst + v.sgst + v.igst),
      };
    });
    const totals = sources.reduce(
      (a, s) => ({ taxableValue: a.taxableValue + s.taxableValue, cgst: a.cgst + s.cgst, sgst: a.sgst + s.sgst, igst: a.igst + s.igst, gstTotal: a.gstTotal + s.gstTotal }),
      { taxableValue: 0, cgst: 0, sgst: 0, igst: 0, gstTotal: 0 },
    );

    return {
      month, sources, totals,
      invoices: invoices.map((inv) => ({
        number: inv.number, date: inv.issuedAt, type: inv.type, payerName: inv.payerName, payerBrand: inv.payerBrand,
        payerGstin: inv.payerGstin, city: inv.city, taxableValue: Math.round(taxableOf(inv)), gstPct: inv.gstPct,
        cgst: inv.igstAmount > 0 ? 0 : Math.round(inv.gstAmount / 2), sgst: inv.igstAmount > 0 ? 0 : Math.round(inv.gstAmount / 2),
        igst: Math.round(inv.igstAmount), total: Math.round(inv.total),
      })),
    };
  }

  /** Real monthly TCS report (GST Act s.52) — supplier-wise (organizer/
   * venue), the shape a GSTR-8 filing needs: gross value of taxable
   * supplies made through Prebooze and the TCS withheld against each, under
   * THAT supplier's own GSTIN — never Prebooze's own income. Sourced from
   * OrganizerLedgerTx/VenueLedgerTx 'sale' rows' own tcsAmount/
   * tcsBaseAmount snapshots (not recomputed), same reasoning as the refund
   * reversal fix — a changed tcsPct later must never change what an
   * already-reported month shows. Empty while PlatformSettings.tcsEnabled
   * is off, by design. */
  async tcs(month: string) {
    const { from, to } = this.monthRange(month);
    const dateWhere = dateRangeWhere(from, to);
    // 'tcs_adjustment' rows (2026-10-04) are a retroactive backfill for a
    // sale credited before TCS was turned on for that event — real TCS
    // withheld, same as a 'sale' row's own tcsAmount, just applied after
    // the fact. Missing them here would silently under-report a month that
    // happened to include a backfill.
    const [orgRows, venueRows] = await Promise.all([
      this.prisma.organizerLedgerTx.findMany({ where: { type: { in: ['sale', 'tcs_adjustment'] }, tcsAmount: { gt: 0 }, createdAt: dateWhere }, select: { organizerId: true, tcsAmount: true, tcsBaseAmount: true } }),
      this.prisma.venueLedgerTx.findMany({ where: { type: { in: ['sale', 'tcs_adjustment'] }, tcsAmount: { gt: 0 }, createdAt: dateWhere }, select: { venueId: true, tcsAmount: true, tcsBaseAmount: true } }),
    ]);

    const byPayee = new Map<string, { payeeType: 'organizer' | 'venue'; payeeId: string; grossValue: number; tcsAmount: number }>();
    for (const r of orgRows) {
      const key = `organizer:${r.organizerId}`;
      const cur = byPayee.get(key) ?? { payeeType: 'organizer' as const, payeeId: r.organizerId, grossValue: 0, tcsAmount: 0 };
      cur.grossValue += r.tcsBaseAmount ?? 0;
      cur.tcsAmount += r.tcsAmount;
      byPayee.set(key, cur);
    }
    for (const r of venueRows) {
      const key = `venue:${r.venueId}`;
      const cur = byPayee.get(key) ?? { payeeType: 'venue' as const, payeeId: r.venueId, grossValue: 0, tcsAmount: 0 };
      cur.grossValue += r.tcsBaseAmount ?? 0;
      cur.tcsAmount += r.tcsAmount;
      byPayee.set(key, cur);
    }

    const organizerIds = [...byPayee.values()].filter((v) => v.payeeType === 'organizer').map((v) => v.payeeId);
    const venueIds = [...byPayee.values()].filter((v) => v.payeeType === 'venue').map((v) => v.payeeId);
    const [organizers, venues, orgProfiles, venueProfiles] = await Promise.all([
      this.prisma.organizer.findMany({ where: { id: { in: organizerIds } }, select: { id: true, brandName: true, state: true } }),
      this.prisma.venue.findMany({ where: { id: { in: venueIds } }, select: { id: true, name: true, state: true } }),
      this.prisma.paymentProfile.findMany({ where: { organizerId: { in: organizerIds }, isDefault: true }, select: { organizerId: true, gstin: true } }),
      this.prisma.venuePaymentProfile.findMany({ where: { venueId: { in: venueIds }, isDefault: true }, select: { venueId: true, gstin: true } }),
    ]);
    const orgMap = new Map(organizers.map((o) => [o.id, o]));
    const venueMap = new Map(venues.map((v) => [v.id, v]));
    const orgGstinMap = new Map(orgProfiles.map((p) => [p.organizerId, p.gstin]));
    const venueGstinMap = new Map(venueProfiles.map((p) => [p.venueId, p.gstin]));

    const rows = [...byPayee.values()]
      .map((v) => {
        const name = v.payeeType === 'organizer' ? orgMap.get(v.payeeId)?.brandName : venueMap.get(v.payeeId)?.name;
        const state = v.payeeType === 'organizer' ? orgMap.get(v.payeeId)?.state : venueMap.get(v.payeeId)?.state;
        const gstin = v.payeeType === 'organizer' ? orgGstinMap.get(v.payeeId) : venueGstinMap.get(v.payeeId);
        // Same intra/inter-state comparison payout-breakdown.ts's computeGst
        // call uses — the payee's own state vs Prebooze's Maharashtra
        // registration. A whole payee's monthly total is either all
        // same-state or all inter-state (their registered state doesn't
        // change mid-month), so splitting the aggregate this way matches
        // what summing each sale's own computeGst() result would give.
        const sameState = !state || state.trim().toLowerCase() === PREBOOZE_GST_STATE.toLowerCase();
        const half = sameState ? Math.round(v.tcsAmount / 2) : 0;
        return {
          payeeType: v.payeeType, payeeId: v.payeeId, payeeName: name ?? v.payeeId, gstin: gstin ?? null, state: state ?? null,
          grossValue: Math.round(v.grossValue), tcsAmount: Math.round(v.tcsAmount),
          cgst: half, sgst: sameState ? v.tcsAmount - half : 0, igst: sameState ? 0 : v.tcsAmount,
        };
      })
      .sort((a, b) => b.tcsAmount - a.tcsAmount);

    const totals = rows.reduce(
      (a, r) => ({ grossValue: a.grossValue + r.grossValue, tcsAmount: a.tcsAmount + r.tcsAmount, cgst: a.cgst + r.cgst, sgst: a.sgst + r.sgst, igst: a.igst + r.igst }),
      { grossValue: 0, tcsAmount: 0, cgst: 0, sgst: 0, igst: 0 },
    );

    return { month, rows, totals };
  }
}

/** `to` from an HTML date input is a bare `YYYY-MM-DD` — treated as UTC
 * midnight by `new Date()`, which would silently exclude every sale made
 * later that same day. Bumped to the last instant of that day so the
 * selected end date is fully inclusive, same as the old mock's
 * `${to}T23:59:59` convention. */
// Correction to the comment this replaced: checked empirically (server
// clock + a real Booking row) — the VPS runs UTC and createdAt values are
// genuine UTC instants, not IST wall-clock mislabeled as UTC. `from`/`to`
// are bare "YYYY-MM-DD" IST calendar days (what the admin's date pickers
// send — see Analytics.tsx/Reports.tsx's own local-date fix), so the
// boundaries need to mean IST midnight-to-midnight, not UTC's — a bare
// date-only string parses as *UTC* midnight per spec, which starts 5.5h
// late and, symmetrically, would have ended 5.5h into the next IST day.
function dateRangeWhere(from?: string, to?: string): Prisma.DateTimeFilter | undefined {
  if (!from && !to) return undefined;
  return {
    ...(from ? { gte: istDayStart(from) } : {}),
    ...(to ? { lte: istDayEnd(to) } : {}),
  };
}
