import { BadRequestException, Injectable } from '@nestjs/common';
import type { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from './notifications.service';

const LIVE_BOOKING_STATUSES: BookingStatus[] = ['confirmed', 'refund_requested'];

/** prebooze-admin's /payments page — distinct from Reports (platform P&L)
 * and Ledger (internal income/expense book): this is the per-event,
 * per-organizer payout register with a literal "run the batch" action.
 * "Payouts due", "Withdrawal requests", "Transactions" and "Refunds" are
 * real; "Disputes" remains the mock's self-admitted placeholder ("coming
 * with backend integration") — there's no dispute/chargeback concept
 * anywhere in the system to back it (no model, no Razorpay webhook). */
@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async payoutsDue() {
    // A payout is only ever due once the event has actually happened — an
    // organizer can't be paid out on ticket sales for a show that hasn't
    // run yet (see BACKEND.md — this used to include every non-draft event
    // regardless of date, which let the auto-payout cron mark events as
    // "paid" days before they even took place).
    const events = await this.prisma.event.findMany({
      where: { status: { not: 'draft' }, commission: { not: null } },
      select: { id: true, title: true, date: true, durationHrs: true, commission: true, paidOut: true, payoutUtr: true, organizerId: true, venueId: true, organizer: { select: { brandName: true } }, venue: { select: { name: true } }, hostedByVenue: true },
    }).then((rows) => rows.filter((e) => new Date(e.date).getTime() + e.durationHrs * 3600_000 <= Date.now()));
    const revenueByEvent = await this.prisma.booking.groupBy({
      by: ['eventId'],
      where: { status: { in: LIVE_BOOKING_STATUSES } },
      _sum: { subtotal: true },
    });
    const revMap = new Map(revenueByEvent.map((r) => [r.eventId, r._sum.subtotal ?? 0]));

    // Prebooze isn't GST-registered, so nothing is withheld from an
    // organizer's payout beyond its own commission — `net` here is exactly
    // what OrganizerLedgerTx already credits them (see BookingsService),
    // so this on-screen figure and the real ledger balance always agree.
    const rows = events.map((e) => {
      const revenue = revMap.get(e.id) ?? 0;
      const commissionAmt = Math.round((revenue * (e.commission as number)) / 100);
      // Solo venue-hosted event (no organizer) — this is who staff actually
      // need to pay out for this event's commission. payeeType/payeeId let
      // the frontend jump straight to that payee's real bank details
      // (Payment details page) instead of just showing a display name with
      // nowhere to click through to.
      const payeeType: 'organizer' | 'venue' | null = e.organizerId ? 'organizer' : e.venueId ? 'venue' : null;
      const payeeId = e.organizerId ?? e.venueId ?? null;
      return {
        id: e.id,
        title: e.title,
        organizer: e.organizer?.brandName ?? e.venue?.name ?? '—',
        payeeType,
        payeeId,
        revenue,
        commission: e.commission,
        commissionAmt,
        net: revenue - commissionAmt,
        paidOut: e.paidOut,
        payoutUtr: e.payoutUtr,
      };
    });

    const due = rows.filter((r) => !r.paidOut);
    const collected = rows.reduce((a, r) => a + r.revenue, 0);
    const commissionKept = rows.reduce((a, r) => a + r.commissionAmt, 0);
    const dueTotal = due.reduce((a, r) => a + r.net, 0);

    return { rows, collected, commissionKept, dueTotal };
  }

  /** Manual only, one real transfer at a time — there's no real bank/IMPS
   * integration behind this (see BACKEND.md), so this used to auto-generate
   * a fake "UTR" and flip paidOut the instant someone clicked a button,
   * including for events that hadn't even happened yet via the auto-payout
   * cron. Now it just records the UTR the admin got from actually sending
   * the money themselves, after the fact — this is bookkeeping, not a
   * payment rail. */
  async markPaid(eventId: string, utr: string) {
    if (!utr?.trim()) throw new BadRequestException('Enter the real UTR / transaction reference for this transfer');
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new BadRequestException('Event not found');
    if (event.paidOut) throw new BadRequestException('This event is already marked paid');
    if (new Date(event.date).getTime() + event.durationHrs * 3600_000 > Date.now()) {
      throw new BadRequestException("This event hasn't happened yet — payouts can only be marked paid after the event completes");
    }
    const updated = await this.prisma.event.update({ where: { id: eventId }, data: { paidOut: true, payoutUtr: utr.trim() } });
    await this.notifications.notify('💸', `Payout marked paid — "${event.title}" · ${utr.trim()}`, '/admin/payments');
    return updated;
  }

  /** Organizers can self-serve withdraw their ledger balance any time, for
   * any amount, capped at what they've actually earned (see
   * OrganizerService.withdraw) — an instant debit with no approval step
   * and, until now, zero admin visibility: nothing surfaced these requests
   * anywhere in admin. This is that missing view — every real
   * OrganizerLedgerTx row of type 'withdrawal', newest first, with the
   * bank-details snapshot the organizer's default PaymentProfile had at the
   * moment they withdrew (payoutBankLast4/payoutAccountHolderName/
   * payoutIfsc — captured on the ledger row itself, so it stays accurate
   * even if they later change their default profile), plus withdrawalPaidOut
   * so admin can actually track which of these they've sent the money for.
   * `amount` is stored negative (a debit); returned positive here since
   * admin only ever wants to see "how much did they take out." */
  async organizerWithdrawals() {
    const rows = await this.prisma.organizerLedgerTx.findMany({
      where: { type: 'withdrawal' },
      select: {
        id: true, organizerId: true, amount: true, createdAt: true,
        payoutBankLast4: true, payoutAccountHolderName: true, payoutIfsc: true,
        withdrawalPaidOut: true, withdrawalPaidUtr: true,
        organizer: { select: { brandName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map((r) => ({
      id: r.id,
      organizerId: r.organizerId,
      organizerName: r.organizer?.brandName ?? '—',
      amount: Math.abs(r.amount),
      paidOut: r.withdrawalPaidOut,
      paidUtr: r.withdrawalPaidUtr,
      bankLast4: r.payoutBankLast4,
      accountHolderName: r.payoutAccountHolderName,
      ifsc: r.payoutIfsc,
      createdAt: r.createdAt,
    }));
  }

  /** Same UTR requirement as PaymentsService.markPaid's per-event flow —
   * this is bookkeeping only, never moves money, so a real transfer
   * reference is what makes the record actually mean something. */
  async markOrganizerWithdrawalPaid(id: string, utr: string) {
    if (!utr?.trim()) throw new BadRequestException('Enter the real UTR / transaction reference for this transfer');
    const row = await this.prisma.organizerLedgerTx.findUnique({ where: { id } });
    if (!row || row.type !== 'withdrawal') throw new BadRequestException('Withdrawal request not found');
    if (row.withdrawalPaidOut) throw new BadRequestException('Already marked paid');
    return this.prisma.organizerLedgerTx.update({ where: { id }, data: { withdrawalPaidOut: true, withdrawalPaidUtr: utr.trim() } });
  }

  /** Platform-wide sale/refund ledger — closes the "Transactions" tab,
   * which was a bare "coming with backend integration" placeholder despite
   * OrganizerLedgerTx/VenueLedgerTx already recording every real sale and
   * refund (BookingsService writes both on every paid/refunded booking).
   * Withdrawals aren't included — those already have their own dedicated
   * tab above. Merges both ledgers since a sale can credit either an
   * organizer or a solo venue-hosted event, same payeeType split as
   * payoutsDue(). Capped at the most recent 300 — this is a real-time feed
   * to check, not a full export. */
  async transactions(eventId?: string) {
    const [orgRows, venueRows] = await Promise.all([
      this.prisma.organizerLedgerTx.findMany({
        where: { type: { in: ['sale', 'refund'] }, ...(eventId ? { eventId } : {}) },
        select: { id: true, type: true, amount: true, eventId: true, eventTitle: true, createdAt: true, organizer: { select: { brandName: true } } },
      }),
      this.prisma.venueLedgerTx.findMany({
        where: { type: { in: ['sale', 'refund'] }, ...(eventId ? { eventId } : {}) },
        select: { id: true, type: true, amount: true, eventId: true, eventTitle: true, createdAt: true, venue: { select: { name: true } } },
      }),
    ]);
    const rows = [
      ...orgRows.map((r) => ({ id: r.id, type: r.type, amount: r.amount, eventId: r.eventId, eventTitle: r.eventTitle, createdAt: r.createdAt, payeeType: 'organizer' as const, payeeName: r.organizer?.brandName ?? '—' })),
      ...venueRows.map((r) => ({ id: r.id, type: r.type, amount: r.amount, eventId: r.eventId, eventTitle: r.eventTitle, createdAt: r.createdAt, payeeType: 'venue' as const, payeeName: r.venue?.name ?? '—' })),
    ].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
    return rows.slice(0, 300);
  }

  /** Platform-wide refund register — closes the "Refunds" tab, another bare
   * placeholder despite a full, real refund flow already existing
   * (BookingsService.cancel/adminApproveRefund/adminDeclineRefund/
   * retryRefund) and an identical query already built for Reports
   * (ReportsService.refunds, date-range-scoped there; this is the same
   * shape but all-time, capped at the most recent 300). Read-only — no
   * approve/decline here, those stay on the booking detail page (a
   * different permission module, 'Refunds', not 'Payments & payouts'); this
   * is a feed to check, same as Transactions above. */
  async refunds() {
    const rows = await this.prisma.booking.findMany({
      where: { status: { in: ['refund_requested', 'refunded'] } },
      select: { id: true, mainGuest: true, total: true, status: true, refundedTo: true, refundFailedAt: true, createdAt: true, event: { select: { title: true } } },
      orderBy: { createdAt: 'desc' },
      take: 300,
    });
    return rows.map((r) => ({
      id: r.id, guest: r.mainGuest, eventTitle: r.event.title, amount: r.total, status: r.status,
      refundedTo: r.refundedTo, failed: !!r.refundFailedAt, createdAt: r.createdAt,
    }));
  }

  /** Platform-wide view of the organizer→promoter revenue-share/per-head
   * money (real bank transfers happen entirely outside Prebooze — see
   * PromoterEventSettlement), across every event, not just one organizer's
   * — same computation OrganizerService.promoterPayouts does for its own
   * scoped view, just without the organizerId filter and with the
   * organizer's own brand name attached so admin can see who owes whom. */
  async promoterPayoutsAll() {
    const events = await this.prisma.event.findMany({
      select: { id: true, title: true, date: true, promoterConfig: true, organizer: { select: { brandName: true } }, venue: { select: { name: true } } },
    });
    const eventIds = events.map((e) => e.id);
    const eventById = new Map(events.map((e) => [e.id, e]));
    if (!eventIds.length) return [];

    const [arrivedGuests, bookings] = await Promise.all([
      this.prisma.promoterGuest.findMany({ where: { eventId: { in: eventIds }, arrived: true }, select: { eventId: true, promoterSlug: true } }),
      this.prisma.booking.findMany({ where: { eventId: { in: eventIds }, status: 'confirmed', promoterCommission: { gt: 0 } }, select: { eventId: true, promoterRef: true, promoterCommission: true } }),
    ]);

    const slugs = new Set<string>([...arrivedGuests.map((g) => g.promoterSlug), ...bookings.map((b) => b.promoterRef).filter((s): s is string => !!s)]);
    const promoters = await this.prisma.promoter.findMany({ where: { slug: { in: [...slugs] } }, select: { id: true, slug: true, name: true } });
    const promoterBySlug = new Map(promoters.map((p) => [p.slug, p]));

    const settlements = await this.prisma.promoterEventSettlement.findMany({
      where: { eventId: { in: eventIds }, promoterId: { in: promoters.map((p) => p.id) } },
    });
    const settlementByKey = new Map(settlements.map((s) => [`${s.eventId}::${s.promoterId}`, s]));

    const rows = new Map<string, { eventId: string; eventTitle: string; eventDate: Date; organizerBrand: string; promoterId: string; promoterName: string; perHead: number; commission: number }>();
    const ensure = (eventId: string, slug: string) => {
      const promoter = promoterBySlug.get(slug);
      if (!promoter) return null;
      const key = `${eventId}::${promoter.id}`;
      let row = rows.get(key);
      if (!row) {
        const event = eventById.get(eventId)!;
        row = { eventId, eventTitle: event.title, eventDate: event.date, organizerBrand: event.organizer?.brandName ?? event.venue?.name ?? '—', promoterId: promoter.id, promoterName: promoter.name, perHead: 0, commission: 0 };
        rows.set(key, row);
      }
      return row;
    };

    for (const g of arrivedGuests) {
      const cfg = eventById.get(g.eventId)?.promoterConfig as unknown as
        { enabled?: boolean; perHeadPayout?: boolean; perHeadAmount?: number; allowedPromoters?: string[]; guestListPromoters?: string[] } | null;
      const glp = cfg?.guestListPromoters ?? cfg?.allowedPromoters ?? [];
      if (!cfg?.enabled || !cfg.perHeadPayout || !glp.includes(g.promoterSlug)) continue;
      const row = ensure(g.eventId, g.promoterSlug);
      if (row) row.perHead += cfg.perHeadAmount ?? 0;
    }
    for (const b of bookings) {
      if (!b.promoterRef) continue;
      const row = ensure(b.eventId, b.promoterRef);
      if (row) row.commission += b.promoterCommission;
    }

    return [...rows.values()]
      .map((r) => ({ ...r, total: r.perHead + r.commission, status: settlementByKey.get(`${r.eventId}::${r.promoterId}`)?.status ?? 'pending' }))
      .sort((a, b) => b.eventDate.getTime() - a.eventDate.getTime());
  }

  /** Prebooze's OWN promoter-referral commission (2026-09-02) — a
   * completely separate money flow from promoterPayoutsAll() above (which
   * is entirely organizer-funded and self-attested). This one Prebooze
   * itself owes directly, so unlike the rest of this file it's grouped
   * per-promoter rather than per-event — a promoter can rack up small
   * amounts across many different organizers' events, and there's no
   * per-event settlement to track since there's no organizer in this loop
   * at all. */
  async platformCommissionDue() {
    const bookings = await this.prisma.booking.findMany({
      where: { status: 'confirmed', promoterPlatformCommission: { gt: 0 }, promoterPlatformCommissionPaidOut: false },
      select: { promoterRef: true, promoterPlatformCommission: true },
    });
    if (!bookings.length) return [];

    const slugs = [...new Set(bookings.map((b) => b.promoterRef).filter((s): s is string => !!s))];
    const promoters = await this.prisma.promoter.findMany({ where: { slug: { in: slugs } }, select: { id: true, slug: true, name: true } });
    const promoterBySlug = new Map(promoters.map((p) => [p.slug, p]));

    const totals = new Map<string, number>();
    for (const b of bookings) {
      if (!b.promoterRef || !promoterBySlug.has(b.promoterRef)) continue;
      totals.set(b.promoterRef, (totals.get(b.promoterRef) ?? 0) + b.promoterPlatformCommission);
    }

    return [...totals.entries()]
      .map(([slug, due]) => {
        const p = promoterBySlug.get(slug)!;
        return { promoterId: p.id, promoterName: p.name, due };
      })
      .sort((a, b) => b.due - a.due);
  }

  /** Marks every currently-unpaid confirmed booking's promoterPlatformCommission
   * for this promoter as paid at once — a batch action, since the amount
   * owed accumulates one small ticket sale at a time across many events, not
   * something staff would realistically pay out per-booking. No UTR field
   * to record here (same as PromoterEventSettlement's own status-only
   * tracking) — this is visibility + a paid/unpaid toggle, not a real bank
   * integration, matching every other payout register in this file. */
  async markPlatformCommissionPaid(promoterId: string) {
    const promoter = await this.prisma.promoter.findUnique({ where: { id: promoterId } });
    if (!promoter) throw new BadRequestException('Promoter not found');
    const { count } = await this.prisma.booking.updateMany({
      where: { promoterRef: promoter.slug, status: 'confirmed', promoterPlatformCommission: { gt: 0 }, promoterPlatformCommissionPaidOut: false },
      data: { promoterPlatformCommissionPaidOut: true },
    });
    return { ok: true, bookingsMarked: count };
  }
}
