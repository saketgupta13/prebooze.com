import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

type PayeeType = 'organizer' | 'venue' | 'platform';
// Synthetic payee (2026-10-04) — not a real Organizer/Venue row, used to
// surface Prebooze's own real income (commission + booking fee, both
// already real per-booking money, just never shown anywhere in this
// payee-centric view before) alongside every other payee's own numbers
// instead of only in Reports' P&L. id/name match PlatformSettings-style
// synthetic ids elsewhere (see 'prebooze-originals' itself) rather than a
// row in any real payee table.
const PLATFORM_PAYEE_ID = 'prebooze';
const PLATFORM_PAYEE_NAME = 'Prebooze (platform income)';

/** A standalone admin section (2026-09-18) — previously a "Transactions"
 * tab bolted onto /payments, but a raw sale/refund ledger feed isn't really
 * a payout concern (it never touches who gets paid or when), so it gets its
 * own module/nav item instead. Also folds in what used to be a separate
 * "Refunds" tab on that page — a refund IS just one of an event's own
 * transactions, not a different concern, so it's now one of two tabs
 * (Sales / Refunds) on a given event rather than a whole separate register.
 * Built directly off `Booking` rather than the ledger's sale/refund rows —
 * richer (guest name, live status) and, since `Booking.commission` is
 * already locked in per-row, showing exactly how much commission a refund
 * gave up needs no derivation at all. */
@Injectable()
export class TransactionsService {
  constructor(private prisma: PrismaService) {}

  private dateFilter(from?: string, to?: string) {
    if (!from && !to) return {};
    return { createdAt: { ...(from ? { gte: new Date(from) } : {}), ...(to ? { lte: new Date(to) } : {}) } };
  }

  private async payeeByEventMap(eventIds: string[]) {
    const events = await this.prisma.event.findMany({
      where: { id: { in: eventIds } },
      select: { id: true, title: true, date: true, organizerId: true, venueId: true, organizer: { select: { brandName: true } }, venue: { select: { name: true } } },
    });
    return new Map(events.map((e) => [
      e.id,
      {
        title: e.title,
        date: e.date,
        payee: e.organizerId
          ? { type: 'organizer' as PayeeType, id: e.organizerId, name: e.organizer?.brandName ?? '—' }
          : e.venueId
            ? { type: 'venue' as PayeeType, id: e.venueId, name: e.venue?.name ?? '—' }
            : null,
      },
    ]));
  }

  /** One row per payee, all-time (or date-scoped) — sales and refunds
   * separated, and only *actually completed* refunds count against the net
   * total; a still-pending refund request hasn't moved any money yet so
   * lumping it in would overstate what's actually been given back. */
  async payeesSummary(from?: string, to?: string) {
    const bookings = await this.prisma.booking.findMany({
      where: { status: { in: ['confirmed', 'refund_requested', 'refunded'] }, ...this.dateFilter(from, to) },
      select: { eventId: true, subtotal: true, commission: true, fee: true, status: true },
    });
    if (!bookings.length) return { rows: [], totals: { salesTotal: 0, refundsTotal: 0, net: 0 } };

    const eventIds = [...new Set(bookings.map((b) => b.eventId))];
    const eventMap = await this.payeeByEventMap(eventIds);

    const grouped = new Map<string, {
      payeeType: PayeeType; payeeId: string; payeeName: string;
      salesCount: number; salesTotal: number;
      refundsCount: number; refundsTotal: number; commissionReversed: number;
      pendingRefundsCount: number;
    }>();
    const platformKey = `platform:${PLATFORM_PAYEE_ID}`;
    for (const b of bookings) {
      const payee = eventMap.get(b.eventId)?.payee;
      if (!payee) continue;
      const key = `${payee.type}:${payee.id}`;
      const g = grouped.get(key) ?? {
        payeeType: payee.type, payeeId: payee.id, payeeName: payee.name,
        salesCount: 0, salesTotal: 0, refundsCount: 0, refundsTotal: 0, commissionReversed: 0, pendingRefundsCount: 0,
      };
      const net = b.subtotal - b.commission;
      if (b.status === 'confirmed') { g.salesCount += 1; g.salesTotal += net; }
      else if (b.status === 'refunded') { g.refundsCount += 1; g.refundsTotal += net; g.commissionReversed += b.commission; }
      else { g.pendingRefundsCount += 1; }
      grouped.set(key, g);

      // Prebooze's own real income on this exact booking — commission +
      // booking fee, both real money Prebooze actually keeps (fee always;
      // commission unless a promoter-markup-funded sale deducted none at
      // all, same "nothing to credit" case creditPayeeForSale encodes).
      // Shown as its own payee row, additive to the real organizer/venue
      // row above, same real per-booking money just from Prebooze's own
      // side rather than the payee's. Prebooze Originals (in-house events,
      // kept at 0% commission — self-dealing, no real external payee) is
      // the one exception: the full ticket subtotal is Prebooze's own
      // money too, same as ReportsService.finance's effectiveCommission.
      const isPrebozeOriginals = payee.type === 'organizer' && payee.id === 'prebooze-originals';
      const platformNet = isPrebozeOriginals ? b.subtotal + b.fee : b.commission + b.fee;
      const pg = grouped.get(platformKey) ?? {
        payeeType: 'platform' as PayeeType, payeeId: PLATFORM_PAYEE_ID, payeeName: PLATFORM_PAYEE_NAME,
        salesCount: 0, salesTotal: 0, refundsCount: 0, refundsTotal: 0, commissionReversed: 0, pendingRefundsCount: 0,
      };
      if (b.status === 'confirmed') { pg.salesCount += 1; pg.salesTotal += platformNet; }
      else if (b.status === 'refunded') { pg.refundsCount += 1; pg.refundsTotal += platformNet; }
      else { pg.pendingRefundsCount += 1; }
      grouped.set(platformKey, pg);
    }

    const rows = [...grouped.values()]
      .map((g) => ({ ...g, net: g.salesTotal - g.refundsTotal }))
      .sort((a, b) => b.net - a.net);
    // Totals stay payee-only (organizer+venue) — the platform row is
    // Prebooze's own cut OF that same money, not additional money moving
    // through the system, so summing it in here would double-count.
    const totals = rows.filter((r) => r.payeeType !== 'platform').reduce((a, r) => ({ salesTotal: a.salesTotal + r.salesTotal, refundsTotal: a.refundsTotal + r.refundsTotal, net: a.net + r.net }), { salesTotal: 0, refundsTotal: 0, net: 0 });
    return { rows, totals };
  }

  /** One payee's events, each with its own sales/refunds aggregate — the
   * list you land on after clicking a payee in payeesSummary(). */
  async payeeEvents(payeeType: PayeeType, payeeId: string, from?: string, to?: string) {
    const events = await this.prisma.event.findMany({
      // 'platform' (the synthetic Prebooze row) covers every event — its
      // income comes from all of them, not a single organizer's/venue's.
      where: payeeType === 'organizer' ? { organizerId: payeeId } : payeeType === 'venue' ? { venueId: payeeId } : {},
      select: { id: true, title: true, date: true, organizerId: true },
    });
    if (!events.length) return { payeeName: '—', rows: [] };
    const eventIds = events.map((e) => e.id);
    const eventById = new Map(events.map((e) => [e.id, e]));

    const bookings = await this.prisma.booking.findMany({
      where: { eventId: { in: eventIds }, status: { in: ['confirmed', 'refund_requested', 'refunded'] }, ...this.dateFilter(from, to) },
      select: { eventId: true, subtotal: true, commission: true, fee: true, status: true },
    });

    const byEvent = new Map<string, { salesCount: number; salesTotal: number; refundsCount: number; refundsTotal: number; commissionReversed: number; pendingRefundsCount: number }>();
    for (const b of bookings) {
      const g = byEvent.get(b.eventId) ?? { salesCount: 0, salesTotal: 0, refundsCount: 0, refundsTotal: 0, commissionReversed: 0, pendingRefundsCount: 0 };
      // Same per-booking framing as payeesSummary: the platform row's "net"
      // is Prebooze's own cut (commission+fee, or full subtotal+fee for
      // Prebooze Originals), everyone else's is what they themselves keep.
      const isPlatform = payeeType === 'platform';
      const isPrebozeOriginals = isPlatform && eventById.get(b.eventId)?.organizerId === 'prebooze-originals';
      const net = isPlatform ? (isPrebozeOriginals ? b.subtotal + b.fee : b.commission + b.fee) : b.subtotal - b.commission;
      if (b.status === 'confirmed') { g.salesCount += 1; g.salesTotal += net; }
      else if (b.status === 'refunded') { g.refundsCount += 1; g.refundsTotal += net; g.commissionReversed += b.commission; }
      else { g.pendingRefundsCount += 1; }
      byEvent.set(b.eventId, g);
    }

    const payeeName = payeeType === 'organizer'
      ? (await this.prisma.organizer.findUnique({ where: { id: payeeId }, select: { brandName: true } }))?.brandName ?? '—'
      : payeeType === 'venue'
        ? (await this.prisma.venue.findUnique({ where: { id: payeeId }, select: { name: true } }))?.name ?? '—'
        : PLATFORM_PAYEE_NAME;

    const rows = eventIds
      .filter((id) => byEvent.has(id))
      .map((id) => {
        const g = byEvent.get(id)!;
        const e = eventById.get(id)!;
        return { eventId: id, eventTitle: e.title, eventDate: e.date, ...g, net: g.salesTotal - g.refundsTotal };
      })
      .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime());

    return { payeeName, rows };
  }

  /** The actual Sales / Refunds tabs for one specific event — real booking
   * rows, not ledger entries, so a refund shows exactly how much commission
   * it gave up (Booking.commission, locked in at sale time) with no
   * derivation needed. */
  async eventTransactions(eventId: string) {
    const event = await this.prisma.event.findUnique({ where: { id: eventId }, select: { title: true } });
    const bookings = await this.prisma.booking.findMany({
      where: { eventId, status: { in: ['confirmed', 'refund_requested', 'refunded'] } },
      select: { id: true, mainGuest: true, subtotal: true, commission: true, status: true, refundedTo: true, refundFailedAt: true, createdAt: true },
      orderBy: { createdAt: 'desc' },
    });
    const sales = bookings.filter((b) => b.status === 'confirmed')
      .map((b) => ({ id: b.id, guest: b.mainGuest, amount: b.subtotal, commission: b.commission, net: b.subtotal - b.commission, createdAt: b.createdAt }));
    const refunds = bookings.filter((b) => b.status !== 'confirmed')
      .map((b) => ({
        id: b.id, guest: b.mainGuest, amount: b.subtotal, commissionReversed: b.commission, net: b.subtotal - b.commission,
        status: b.status, refundedTo: b.refundedTo, failed: !!b.refundFailedAt, createdAt: b.createdAt,
      }));
    return { eventTitle: event?.title ?? '—', sales, refunds };
  }
}
