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

  /** Real current withdrawable balance for one payee — the actual source of
   * truth (sale/refund/withdrawal, all-time), same aggregate
   * OrganizerService.withdraw/VenueService.withdraw themselves check before
   * letting a self-serve withdrawal through. Used below to cap "due" at
   * what's genuinely still sitting uncollected, and to gate markPaid() —
   * see the 2026-09-17 fix note on markPaid for why this exists. */
  private async payeeBalance(payeeType: 'organizer' | 'venue', payeeId: string): Promise<number> {
    const agg = payeeType === 'organizer'
      ? await this.prisma.organizerLedgerTx.aggregate({ where: { organizerId: payeeId }, _sum: { amount: true } })
      : await this.prisma.venueLedgerTx.aggregate({ where: { venueId: payeeId }, _sum: { amount: true } });
    return agg._sum.amount ?? 0;
  }

  private async defaultPaymentProfile(payeeType: 'organizer' | 'venue', payeeId: string) {
    return payeeType === 'organizer'
      ? this.prisma.paymentProfile.findFirst({ where: { organizerId: payeeId, isDefault: true } })
      : this.prisma.venuePaymentProfile.findFirst({ where: { venueId: payeeId, isDefault: true } });
  }

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

    // Real-picture fix (2026-09-17, round 2): a payee who has already filed
    // a self-serve withdrawal request that admin hasn't marked paid yet
    // shouldn't also show up here — that's the exact "two screens for the
    // same money" confusion this whole fix was about. Once their open
    // request is resolved (see markWithdrawalPaid), any of their events
    // still genuinely due reappear here normally.
    const [openOrgWithdrawals, openVenueWithdrawals] = await Promise.all([
      this.prisma.organizerLedgerTx.findMany({ where: { type: 'withdrawal', withdrawalPaidOut: false }, select: { organizerId: true } }),
      this.prisma.venueLedgerTx.findMany({ where: { type: 'withdrawal', withdrawalPaidOut: false }, select: { venueId: true } }),
    ]);
    const openWithdrawalPayees = new Set<string>([
      ...openOrgWithdrawals.map((r) => `organizer:${r.organizerId}`),
      ...openVenueWithdrawals.map((r) => `venue:${r.venueId}`),
    ]);

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

    // Real-picture fix (2026-09-17): this used to sum every not-yet-paidOut
    // event's `net` regardless of whether the payee had already pulled that
    // exact money out via self-serve withdraw (OrganizerService.withdraw /
    // VenueService.withdraw) — a completely separate, unlinked flow. Two
    // organizers were found with real production data confirming staff had
    // to manually notice the overlap themselves (reusing the same UTR by
    // hand across both admin screens) — nothing in the system actually
    // prevented double-counting or double-paying. Capping each payee's
    // total "due" at their real current ledger balance (which already nets
    // out any self-serve withdrawal) is what makes this figure trustworthy
    // — it can now never overstate what's genuinely still uncollected.
    // Rows for a payee with an open withdrawal request are hidden from the
    // list outright (not just excluded from the total) — see the fetch
    // above. A row that's already paidOut, or has no payee at all, is
    // always visible regardless.
    const visibleRows = rows.filter((r) => r.paidOut || !r.payeeType || !r.payeeId || !openWithdrawalPayees.has(`${r.payeeType}:${r.payeeId}`));

    const due = visibleRows.filter((r) => !r.paidOut);
    const payeeKeys = [...new Set(due.filter((r) => r.payeeType && r.payeeId).map((r) => `${r.payeeType}:${r.payeeId}`))];
    const balanceByPayee = new Map<string, number>();
    await Promise.all(payeeKeys.map(async (key) => {
      const [payeeType, payeeId] = key.split(':') as ['organizer' | 'venue', string];
      balanceByPayee.set(key, await this.payeeBalance(payeeType, payeeId));
    }));
    const naiveDueByPayee = new Map<string, number>();
    for (const r of due) {
      if (!r.payeeType || !r.payeeId) continue;
      const key = `${r.payeeType}:${r.payeeId}`;
      naiveDueByPayee.set(key, (naiveDueByPayee.get(key) ?? 0) + r.net);
    }
    const realDueByPayee = new Map<string, number>();
    for (const [key, naive] of naiveDueByPayee) realDueByPayee.set(key, Math.max(0, Math.min(naive, balanceByPayee.get(key) ?? 0)));

    const rowsWithRealDue = visibleRows.map((r) => {
      if (r.paidOut || !r.payeeType || !r.payeeId) return { ...r, payeeBalance: null as number | null };
      return { ...r, payeeBalance: balanceByPayee.get(`${r.payeeType}:${r.payeeId}`) ?? 0 };
    });

    const collected = rows.reduce((a, r) => a + r.revenue, 0);
    const commissionKept = rows.reduce((a, r) => a + r.commissionAmt, 0);
    const dueTotal = [...realDueByPayee.values()].reduce((a, v) => a + v, 0);

    return { rows: rowsWithRealDue, collected, commissionKept, dueTotal };
  }

  /** Manual only, one real transfer at a time — there's no real bank/IMPS
   * integration behind this (see BACKEND.md), so this used to auto-generate
   * a fake "UTR" and flip paidOut the instant someone clicked a button,
   * including for events that hadn't even happened yet via the auto-payout
   * cron. Now it just records the UTR the admin got from actually sending
   * the money themselves, after the fact — this is bookkeeping, not a
   * payment rail.
   *
   * 2026-09-17 fix: this used to be its own completely separate state
   * machine from OrganizerLedgerTx/VenueLedgerTx — nothing here ever
   * checked whether the payee had already self-withdrawn this exact money,
   * and marking an event paid never touched the ledger at all. Confirmed
   * via real production data that staff were already hitting this: an
   * organizer self-withdrew, then admin separately (and correctly, by
   * coincidence of careful manual bookkeeping) marked the same money paid
   * per-event. Now this checks the payee's real current balance first —
   * refusing outright if it doesn't cover the amount, which is exactly the
   * case where the money's already gone out via self-withdraw — and, on
   * success, writes a real ledger withdrawal row alongside the event flag
   * so the two can never drift apart again. */
  async markPaid(eventId: string, utr: string) {
    if (!utr?.trim()) throw new BadRequestException('Enter the real UTR / transaction reference for this transfer');
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new BadRequestException('Event not found');
    if (event.paidOut) throw new BadRequestException('This event is already marked paid');
    if (new Date(event.date).getTime() + event.durationHrs * 3600_000 > Date.now()) {
      throw new BadRequestException("This event hasn't happened yet — payouts can only be marked paid after the event completes");
    }
    const payeeType: 'organizer' | 'venue' | null = event.organizerId ? 'organizer' : event.venueId ? 'venue' : null;
    const payeeId = event.organizerId ?? event.venueId ?? null;
    if (!payeeType || !payeeId) throw new BadRequestException('This event has no organizer or venue to pay out to');

    const revenueAgg = await this.prisma.booking.aggregate({
      where: { eventId, status: { in: LIVE_BOOKING_STATUSES } },
      _sum: { subtotal: true },
    });
    const revenue = revenueAgg._sum.subtotal ?? 0;
    const commissionAmt = Math.round((revenue * (event.commission ?? 0)) / 100);
    const net = revenue - commissionAmt;

    const profile = await this.defaultPaymentProfile(payeeType, payeeId);
    if (!profile) {
      throw new BadRequestException(
        `Bank details not present — this ${payeeType} hasn't added a payment profile yet, so there's nowhere on file to record this payout against. Ask them to add one (Settings → Payment profiles) first.`
      );
    }

    const balance = await this.payeeBalance(payeeType, payeeId);
    if (net > balance) {
      const already = net - balance;
      throw new BadRequestException(
        already > 0
          ? `This event's payout is ₹${net.toLocaleString('en-IN')}, but only ₹${balance.toLocaleString('en-IN')} of that is still uncollected — the rest (₹${already.toLocaleString('en-IN')}) looks like it's already been self-withdrawn. Check the Withdrawal requests tab before marking this paid.`
          : `This event's payout (₹${net.toLocaleString('en-IN')}) exceeds this ${payeeType}'s current balance (₹${balance.toLocaleString('en-IN')}) — can't mark it paid.`
      );
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.event.update({ where: { id: eventId }, data: { paidOut: true, payoutUtr: utr.trim() } }),
      payeeType === 'organizer'
        ? this.prisma.organizerLedgerTx.create({
            data: {
              organizerId: payeeId, type: 'withdrawal', amount: -net, eventId, eventTitle: event.title,
              note: `Payout for "${event.title}" (admin-initiated)`,
              paymentProfileId: profile.id, payoutBankLast4: profile.bankLast4, payoutAccountHolderName: profile.accountHolderName, payoutIfsc: profile.ifsc,
              withdrawalPaidOut: true, withdrawalPaidUtr: utr.trim(),
            },
          })
        : this.prisma.venueLedgerTx.create({
            data: {
              venueId: payeeId, type: 'withdrawal', amount: -net, eventId, eventTitle: event.title,
              note: `Payout for "${event.title}" (admin-initiated)`,
              paymentProfileId: profile.id, payoutBankLast4: profile.bankLast4, payoutAccountHolderName: profile.accountHolderName, payoutIfsc: profile.ifsc,
              withdrawalPaidOut: true, withdrawalPaidUtr: utr.trim(),
            },
          }),
    ]);
    await this.notifications.notify('💸', `Payout marked paid — "${event.title}" · ${utr.trim()}`, '/admin/payments');
    return updated;
  }

  /** Organizers AND venues can both self-serve withdraw their ledger balance
   * any time, for any amount, capped at what they've actually earned (see
   * OrganizerService.withdraw / VenueService.withdraw) — an instant debit
   * with no approval step. Until 2026-09-06 there was zero admin visibility
   * into either; until this 2026-09-17 fix, venue withdrawals specifically
   * still had none — this method only ever queried OrganizerLedgerTx, so a
   * venue that self-withdrew simply never showed up anywhere in admin at
   * all. Now merges both ledgers, newest first, each row carrying the
   * bank-details snapshot from whichever PaymentProfile/VenuePaymentProfile
   * was default at the moment they withdrew (stays accurate even if they
   * later change their default profile). `amount` is stored negative (a
   * debit); returned positive here since admin only ever wants to see "how
   * much did they take out." */
  async withdrawalRequests() {
    const [orgRows, venueRows] = await Promise.all([
      this.prisma.organizerLedgerTx.findMany({
        where: { type: 'withdrawal' },
        select: {
          id: true, organizerId: true, amount: true, createdAt: true,
          payoutBankLast4: true, payoutAccountHolderName: true, payoutIfsc: true,
          withdrawalPaidOut: true, withdrawalPaidUtr: true,
          organizer: { select: { brandName: true } },
        },
      }),
      this.prisma.venueLedgerTx.findMany({
        where: { type: 'withdrawal' },
        select: {
          id: true, venueId: true, amount: true, createdAt: true,
          payoutBankLast4: true, payoutAccountHolderName: true, payoutIfsc: true,
          withdrawalPaidOut: true, withdrawalPaidUtr: true,
          venue: { select: { name: true } },
        },
      }),
    ]);
    const rows = [
      ...orgRows.map((r) => ({
        id: r.id, payeeType: 'organizer' as const, payeeId: r.organizerId, payeeName: r.organizer?.brandName ?? '—',
        amount: Math.abs(r.amount), paidOut: r.withdrawalPaidOut, paidUtr: r.withdrawalPaidUtr,
        bankLast4: r.payoutBankLast4, accountHolderName: r.payoutAccountHolderName, ifsc: r.payoutIfsc, createdAt: r.createdAt,
      })),
      ...venueRows.map((r) => ({
        id: r.id, payeeType: 'venue' as const, payeeId: r.venueId, payeeName: r.venue?.name ?? '—',
        amount: Math.abs(r.amount), paidOut: r.withdrawalPaidOut, paidUtr: r.withdrawalPaidUtr,
        bankLast4: r.payoutBankLast4, accountHolderName: r.payoutAccountHolderName, ifsc: r.payoutIfsc, createdAt: r.createdAt,
      })),
    ];
    return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /** Same UTR requirement as PaymentsService.markPaid's per-event flow —
   * this is bookkeeping only, never moves money, so a real transfer
   * reference is what makes the record actually mean something. One method
   * for both payee types (2026-09-17 — previously organizer-only, which is
   * exactly how venue withdrawals ended up with no mark-paid path at all). */
  async markWithdrawalPaid(payeeType: 'organizer' | 'venue', id: string, utr: string) {
    if (!utr?.trim()) throw new BadRequestException('Enter the real UTR / transaction reference for this transfer');
    if (payeeType === 'organizer') {
      const row = await this.prisma.organizerLedgerTx.findUnique({ where: { id } });
      if (!row || row.type !== 'withdrawal') throw new BadRequestException('Withdrawal request not found');
      if (row.withdrawalPaidOut) throw new BadRequestException('Already marked paid');
      return this.prisma.organizerLedgerTx.update({ where: { id }, data: { withdrawalPaidOut: true, withdrawalPaidUtr: utr.trim() } });
    }
    const row = await this.prisma.venueLedgerTx.findUnique({ where: { id } });
    if (!row || row.type !== 'withdrawal') throw new BadRequestException('Withdrawal request not found');
    if (row.withdrawalPaidOut) throw new BadRequestException('Already marked paid');
    return this.prisma.venueLedgerTx.update({ where: { id }, data: { withdrawalPaidOut: true, withdrawalPaidUtr: utr.trim() } });
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
