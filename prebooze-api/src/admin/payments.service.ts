import { BadRequestException, Injectable } from '@nestjs/common';
import type { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { CatalogService } from '../catalog/catalog.service';
import { NotificationsService } from './notifications.service';
import { EmailService } from '../notifications/email';
import { money } from '../notifications/email-templates';

const LIVE_BOOKING_STATUSES: BookingStatus[] = ['confirmed', 'refund_requested'];

// The real operational pipeline behind every self-serve withdrawal request
// (2026-09-18) — see OrganizerLedgerTx.withdrawalStatus in schema.prisma for
// the full design note. Forward-only; 'rejected' is reachable from any
// non-terminal status but never appears in this order (see advanceWithdrawal).
const PIPELINE_ORDER = ['requested', 'received', 'initiated', 'processed', 'complete'] as const;
type PipelineStatus = (typeof PIPELINE_ORDER)[number];

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
    private email: EmailService,
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

  /** organizerId/venueId → the userId to notify — a real transfer or a
   * rejection both need to reach the actual person, not just update a row. */
  private async payeeUser(payeeType: 'organizer' | 'venue', payeeId: string) {
    const row = payeeType === 'organizer'
      ? await this.prisma.organizer.findUnique({ where: { id: payeeId }, select: { userId: true } })
      : await this.prisma.venue.findUnique({ where: { id: payeeId }, select: { userId: true } });
    if (!row?.userId) return null;
    return this.prisma.user.findUnique({ where: { id: row.userId } });
  }

  /** Every non-draft, already-happened event's own revenue/commission/net —
   * the one real computation both payoutsDue() (grouped by payee) and
   * payeeDetail() (scoped to one payee) build on, so the two screens can
   * never show different numbers for the same event. */
  private async eventPayoutRows() {
    const events = await this.prisma.event.findMany({
      where: { status: { not: 'draft' }, commission: { not: null } },
      select: { id: true, title: true, date: true, durationHrs: true, seriesEndDate: true, commission: true, paidOut: true, payoutUtr: true, organizerId: true, venueId: true, organizer: { select: { brandName: true } }, venue: { select: { name: true } }, hostedByVenue: true },
    }).then((rows) => rows.filter((e) => CatalogService.isEventOver(e)));
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
    return events.map((e) => {
      const revenue = revMap.get(e.id) ?? 0;
      const commissionAmt = Math.round((revenue * (e.commission as number)) / 100);
      // Solo venue-hosted event (no organizer) — this is who staff actually
      // need to pay out for this event's commission.
      const payeeType: 'organizer' | 'venue' | null = e.organizerId ? 'organizer' : e.venueId ? 'venue' : null;
      const payeeId = e.organizerId ?? e.venueId ?? null;
      return {
        id: e.id,
        title: e.title,
        date: e.date,
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
  }

  /** Every finished event's own revenue/commission/payout, all-time, not
   * just what's currently due (2026-09-18) — "Payouts due" is a work queue
   * (only unpaid, only visible payees), this is the real full accounting
   * record: what we've collected and kept as commission, event by event,
   * since day one. Newest first.
   *
   * Deliberately does NOT return a "total paid out" figure here — summing
   * this list's own `paidOut` flags would undercount: a self-serve
   * withdrawal (OrganizerService.withdraw / VenueService.withdraw) doesn't
   * set any event's `paidOut` flag at all, it's not tied to one specific
   * event. The one real "how much have we actually sent out, all-time"
   * number lives on the page's shared KPI row, computed from the withdrawal
   * ledger itself (every 'complete' row, whichever route it came through)
   * — see Payments.tsx — precisely so there's never two different
   * "paid out" totals on the same screen that can quietly drift apart. */
  async allEventsPayout() {
    const rows = await this.eventPayoutRows();
    const collected = rows.reduce((a, r) => a + r.revenue, 0);
    const commissionKept = rows.reduce((a, r) => a + r.commissionAmt, 0);
    const sorted = [...rows].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    return { rows: sorted, collected, commissionKept };
  }

  /** organizerId/venueId → payees with a self-serve withdrawal request admin
   * hasn't resolved yet (not yet 'complete' or 'rejected') — see
   * payoutsDue's use of this for why these get hidden from that list. */
  private async openWithdrawalPayees(): Promise<Set<string>> {
    const [openOrg, openVenue] = await Promise.all([
      this.prisma.organizerLedgerTx.findMany({ where: { type: 'withdrawal', withdrawalStatus: { notIn: ['complete', 'rejected'] } }, select: { organizerId: true } }),
      this.prisma.venueLedgerTx.findMany({ where: { type: 'withdrawal', withdrawalStatus: { notIn: ['complete', 'rejected'] } }, select: { venueId: true } }),
    ]);
    return new Set<string>([
      ...openOrg.map((r) => `organizer:${r.organizerId}`),
      ...openVenue.map((r) => `venue:${r.venueId}`),
    ]);
  }

  /** One row per payee, not per event (2026-09-18) — a payee with ten small
   * events used to mean ten separate "Payouts due" rows to individually
   * click "Mark paid" on; now it's one entry with an event count, and the
   * per-event commission breakdown lives on that payee's own detail page
   * (payeeDetail below) instead of cluttering this work queue. */
  async payoutsDue() {
    const rows = await this.eventPayoutRows();

    // Real-picture fix (2026-09-17, round 2): a payee who has already filed
    // a self-serve withdrawal request admin hasn't resolved yet shouldn't
    // also show up here — that's the exact "two screens for the same money"
    // confusion this whole fix was about. Once their open request is
    // resolved (see advanceWithdrawal), any of their events still genuinely
    // due reappear here normally.
    const openWithdrawalPayees = await this.openWithdrawalPayees();
    const due = rows.filter((r) => !r.paidOut && r.payeeType && r.payeeId && !openWithdrawalPayees.has(`${r.payeeType}:${r.payeeId}`));

    const payeeKeys = [...new Set(due.map((r) => `${r.payeeType}:${r.payeeId}`))];
    const balanceByPayee = new Map<string, number>();
    await Promise.all(payeeKeys.map(async (key) => {
      const [payeeType, payeeId] = key.split(':') as ['organizer' | 'venue', string];
      balanceByPayee.set(key, await this.payeeBalance(payeeType, payeeId));
    }));

    // Real-picture fix (2026-09-17): this used to sum every not-yet-paidOut
    // event's `net` regardless of whether the payee had already pulled that
    // exact money out via self-serve withdraw — a completely separate,
    // unlinked flow. Capping each payee's total "due" at their real current
    // ledger balance (which already nets out any self-serve withdrawal) is
    // what makes this figure trustworthy — it can now never overstate
    // what's genuinely still uncollected.
    const grouped = new Map<string, { payeeType: 'organizer' | 'venue'; payeeId: string; payeeName: string; eventCount: number; naiveNet: number }>();
    for (const r of due) {
      const key = `${r.payeeType}:${r.payeeId}`;
      const g = grouped.get(key) ?? { payeeType: r.payeeType as 'organizer' | 'venue', payeeId: r.payeeId as string, payeeName: r.organizer, eventCount: 0, naiveNet: 0 };
      g.eventCount += 1;
      g.naiveNet += r.net;
      grouped.set(key, g);
    }

    const payeeRows = [...grouped.values()].map((g) => {
      const key = `${g.payeeType}:${g.payeeId}`;
      const payeeBalance = balanceByPayee.get(key) ?? 0;
      return {
        payeeType: g.payeeType,
        payeeId: g.payeeId,
        payeeName: g.payeeName,
        eventCount: g.eventCount,
        due: Math.max(0, Math.min(g.naiveNet, payeeBalance)),
        payeeBalance,
      };
    }).filter((r) => r.due > 0); // nothing left to actually pay this payee (e.g. every one of their events nets to ₹0) isn't a queue item

    const collected = rows.reduce((a, r) => a + r.revenue, 0);
    const commissionKept = rows.reduce((a, r) => a + r.commissionAmt, 0);
    const dueTotal = payeeRows.reduce((a, r) => a + r.due, 0);

    return { rows: payeeRows, collected, commissionKept, dueTotal };
  }

  /** Flat per-event feed behind /payments/run's bulk "select several, enter
   * a UTR for each, confirm all at once" tool — payoutsDue() above groups by
   * payee for the main work queue, but batch-processing several DIFFERENT
   * events (each its own real bank transfer, so each still needs its own
   * UTR either way) is still a real, distinct workflow worth keeping a flat
   * list for. Same visibility rules as payoutsDue (event happened, not
   * already paid, payee has no open self-serve withdrawal request). */
  async payoutsDueEvents() {
    const rows = await this.eventPayoutRows();
    const openWithdrawalPayees = await this.openWithdrawalPayees();
    const due = rows.filter((r) => !r.paidOut && r.payeeType && r.payeeId && !openWithdrawalPayees.has(`${r.payeeType}:${r.payeeId}`));
    const payeeKeys = [...new Set(due.map((r) => `${r.payeeType}:${r.payeeId}`))];
    const balanceByPayee = new Map<string, number>();
    await Promise.all(payeeKeys.map(async (key) => {
      const [payeeType, payeeId] = key.split(':') as ['organizer' | 'venue', string];
      balanceByPayee.set(key, await this.payeeBalance(payeeType, payeeId));
    }));
    return due.map((r) => ({ ...r, payeeBalance: balanceByPayee.get(`${r.payeeType}:${r.payeeId}`) ?? 0 }));
  }

  /** Everything staff need for one payee in one screen (2026-09-18) — bank
   * details (fetched by the frontend from the existing payment-profiles
   * endpoint, same data admin already had), every event's own commission
   * breakdown (paid and due, so this is the real historical record that
   * used to live in the flat "Payouts due" list), and the full self-serve
   * withdrawal history with its real status timeline. */
  async payeeDetail(payeeType: 'organizer' | 'venue', payeeId: string) {
    const allRows = await this.eventPayoutRows();
    const events = allRows.filter((r) => r.payeeType === payeeType && r.payeeId === payeeId);
    const balance = await this.payeeBalance(payeeType, payeeId);
    const payeeName = events[0]?.organizer ?? (payeeType === 'organizer'
      ? (await this.prisma.organizer.findUnique({ where: { id: payeeId }, select: { brandName: true } }))?.brandName
      : (await this.prisma.venue.findUnique({ where: { id: payeeId }, select: { name: true } }))?.name) ?? '—';

    const naiveDue = events.filter((r) => !r.paidOut).reduce((a, r) => a + r.net, 0);
    const dueTotal = Math.max(0, Math.min(naiveDue, balance));

    const withdrawals = await this.payeeWithdrawals(payeeType, payeeId);
    const hasOpenWithdrawal = withdrawals.some((w) => w.status !== 'complete' && w.status !== 'rejected');

    return {
      payeeType, payeeId, payeeName, balance, dueTotal, hasOpenWithdrawal,
      events: events.map((r) => ({ ...r, payeeBalance: r.paidOut ? null : balance })),
      withdrawals,
    };
  }

  /** This one payee's self-serve withdrawal ledger rows, each carrying its
   * full PayoutStatusEvent timeline (oldest first, so the UI can render it
   * as a real chronological history) — the shared piece behind both
   * payeeDetail (admin) and, in shape, what the organizer/venue's own
   * payout-history page shows about themselves. */
  private async payeeWithdrawals(payeeType: 'organizer' | 'venue', payeeId: string) {
    const rows = payeeType === 'organizer'
      ? await this.prisma.organizerLedgerTx.findMany({ where: { organizerId: payeeId, type: 'withdrawal' }, orderBy: { createdAt: 'desc' } })
      : await this.prisma.venueLedgerTx.findMany({ where: { venueId: payeeId, type: 'withdrawal' }, orderBy: { createdAt: 'desc' } });
    if (!rows.length) return [];
    const events = await this.prisma.payoutStatusEvent.findMany({ where: { ledgerTxId: { in: rows.map((r) => r.id) } }, orderBy: { createdAt: 'asc' } });
    const eventsByTx = new Map<string, typeof events>();
    for (const e of events) eventsByTx.set(e.ledgerTxId, [...(eventsByTx.get(e.ledgerTxId) ?? []), e]);
    return rows.map((r) => ({
      id: r.id,
      amount: Math.abs(r.amount),
      status: r.withdrawalStatus,
      rejectedReason: r.withdrawalRejectedReason,
      rejectionResolved: r.withdrawalRejectionResolved,
      utr: r.withdrawalPaidUtr,
      bankLast4: r.payoutBankLast4,
      accountHolderName: r.payoutAccountHolderName,
      ifsc: r.payoutIfsc,
      createdAt: r.createdAt,
      statusEvents: eventsByTx.get(r.id) ?? [],
    }));
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
  async markPaid(eventId: string, utr: string, staffEmail: string) {
    if (!utr?.trim()) throw new BadRequestException('Enter the real UTR / transaction reference for this transfer');
    const event = await this.prisma.event.findUnique({ where: { id: eventId } });
    if (!event) throw new BadRequestException('Event not found');
    if (event.paidOut) throw new BadRequestException('This event is already marked paid');
    if (!CatalogService.isEventOver(event)) {
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

    // Born already at 'complete' — unlike a self-serve withdrawal, admin has
    // just told us the real transfer already happened (that's what the UTR
    // is), so there's no request→...→processed pipeline to walk through
    // here. Still gets one PayoutStatusEvent so it appears in this payee's
    // tracking timeline alongside their self-serve requests, not just as a
    // silent ledger row.
    const [updated, ledgerTx] = await this.prisma.$transaction([
      this.prisma.event.update({ where: { id: eventId }, data: { paidOut: true, payoutUtr: utr.trim() } }),
      payeeType === 'organizer'
        ? this.prisma.organizerLedgerTx.create({
            data: {
              organizerId: payeeId, type: 'withdrawal', amount: -net, eventId, eventTitle: event.title,
              note: `Payout for "${event.title}" (admin-initiated)`,
              paymentProfileId: profile.id, payoutBankLast4: profile.bankLast4, payoutAccountHolderName: profile.accountHolderName, payoutIfsc: profile.ifsc,
              withdrawalPaidOut: true, withdrawalPaidUtr: utr.trim(), withdrawalStatus: 'complete',
            },
          })
        : this.prisma.venueLedgerTx.create({
            data: {
              venueId: payeeId, type: 'withdrawal', amount: -net, eventId, eventTitle: event.title,
              note: `Payout for "${event.title}" (admin-initiated)`,
              paymentProfileId: profile.id, payoutBankLast4: profile.bankLast4, payoutAccountHolderName: profile.accountHolderName, payoutIfsc: profile.ifsc,
              withdrawalPaidOut: true, withdrawalPaidUtr: utr.trim(), withdrawalStatus: 'complete',
            },
          }),
    ]);
    await this.prisma.payoutStatusEvent.create({
      data: { payeeType, payeeId, ledgerTxId: ledgerTx.id, status: 'complete', utr: utr.trim(), staffEmail },
    });
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
          withdrawalStatus: true, withdrawalRejectedReason: true, withdrawalRejectionResolved: true, withdrawalPaidUtr: true,
          organizer: { select: { brandName: true } },
        },
      }),
      this.prisma.venueLedgerTx.findMany({
        where: { type: 'withdrawal' },
        select: {
          id: true, venueId: true, amount: true, createdAt: true,
          payoutBankLast4: true, payoutAccountHolderName: true, payoutIfsc: true,
          withdrawalStatus: true, withdrawalRejectedReason: true, withdrawalRejectionResolved: true, withdrawalPaidUtr: true,
          venue: { select: { name: true } },
        },
      }),
    ]);
    const rows = [
      ...orgRows.map((r) => ({
        id: r.id, payeeType: 'organizer' as const, payeeId: r.organizerId, payeeName: r.organizer?.brandName ?? '—',
        amount: Math.abs(r.amount), status: r.withdrawalStatus, rejectedReason: r.withdrawalRejectedReason, rejectionResolved: r.withdrawalRejectionResolved, utr: r.withdrawalPaidUtr,
        bankLast4: r.payoutBankLast4, accountHolderName: r.payoutAccountHolderName, ifsc: r.payoutIfsc, createdAt: r.createdAt,
      })),
      ...venueRows.map((r) => ({
        id: r.id, payeeType: 'venue' as const, payeeId: r.venueId, payeeName: r.venue?.name ?? '—',
        amount: Math.abs(r.amount), status: r.withdrawalStatus, rejectedReason: r.withdrawalRejectedReason, rejectionResolved: r.withdrawalRejectionResolved, utr: r.withdrawalPaidUtr,
        bankLast4: r.payoutBankLast4, accountHolderName: r.payoutAccountHolderName, ifsc: r.payoutIfsc, createdAt: r.createdAt,
      })),
    ];
    return rows.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  /** Advances one self-serve withdrawal request through the real pipeline —
   * requested → received → initiated → processed → complete — or rejects it
   * outright (2026-09-18, replacing the old binary markWithdrawalPaid).
   * Forward-only: each call must name a status strictly later than the
   * row's current one, so staff can't accidentally un-do progress, but MAY
   * skip stages (e.g. requested straight to complete) for a small team that
   * doesn't need every intermediate step tracked on every request.
   * Rejecting is allowed from any non-terminal status and requires a real
   * reason — the payee sees it verbatim — and reverses the original debit
   * with a new positive ledger row rather than deleting anything, so the
   * ledger stays a real append-only record and the balance is exactly
   * right afterwards (nothing is ever just silently dropped). */
  async advanceWithdrawal(payeeType: 'organizer' | 'venue', id: string, next: { status: string; utr?: string; reason?: string }, staffEmail: string) {
    if (payeeType === 'organizer') {
      const row = await this.prisma.organizerLedgerTx.findUnique({ where: { id } });
      if (!row || row.type !== 'withdrawal') throw new BadRequestException('Withdrawal request not found');
      return this.advance(row, payeeType, row.organizerId, next, staffEmail,
        (data) => this.prisma.organizerLedgerTx.update({ where: { id }, data }),
        (amount, note) => this.prisma.organizerLedgerTx.create({ data: { organizerId: row.organizerId, type: 'withdrawal_reversal', amount, eventId: row.eventId, eventTitle: row.eventTitle, note } }),
      );
    }
    const row = await this.prisma.venueLedgerTx.findUnique({ where: { id } });
    if (!row || row.type !== 'withdrawal') throw new BadRequestException('Withdrawal request not found');
    return this.advance(row, payeeType, row.venueId, next, staffEmail,
      (data) => this.prisma.venueLedgerTx.update({ where: { id }, data }),
      (amount, note) => this.prisma.venueLedgerTx.create({ data: { venueId: row.venueId, type: 'withdrawal_reversal', amount, eventId: row.eventId, eventTitle: row.eventTitle, note } }),
    );
  }

  /** Shared transition logic for advanceWithdrawal, generic over which
   * ledger table `row` came from via the two closures — organizerId/venueId
   * live on different columns so the create/update calls can't be unified
   * any more directly than this without losing Prisma's own type-checking. */
  private async advance(
    row: { id: string; amount: number; withdrawalStatus: string },
    payeeType: 'organizer' | 'venue',
    payeeId: string,
    next: { status: string; utr?: string; reason?: string },
    staffEmail: string,
    update: (data: { withdrawalStatus: string; withdrawalPaidOut?: boolean; withdrawalPaidUtr?: string; withdrawalRejectedReason?: string }) => Promise<unknown>,
    createReversal: (amount: number, note: string) => Promise<unknown>,
  ) {
    if (row.withdrawalStatus === 'complete') throw new BadRequestException('This request is already complete');
    if (row.withdrawalStatus === 'rejected') throw new BadRequestException('This request was already rejected');
    const amount = Math.abs(row.amount);

    if (next.status === 'rejected') {
      const reason = next.reason?.trim();
      if (!reason) throw new BadRequestException('Enter a reason so the payee knows what happened');
      await Promise.all([
        update({ withdrawalStatus: 'rejected', withdrawalRejectedReason: reason }),
        createReversal(amount, `Withdrawal request rejected — reversed: ${reason}`),
      ]);
      await this.prisma.payoutStatusEvent.create({ data: { payeeType, payeeId, ledgerTxId: row.id, status: 'rejected', reason, staffEmail } });
      const user = await this.payeeUser(payeeType, payeeId);
      if (user) await this.email.sendTemplate(user.email, 'payout_rejected', { name: user.name, amount: money(amount), reason, role: payeeType }).catch(() => {});
      await this.notifications.notify('❌', `Withdrawal request rejected — ₹${amount.toLocaleString('en-IN')} (${reason})`, '/admin/payments');
      return { ok: true };
    }

    const currentIdx = PIPELINE_ORDER.indexOf(row.withdrawalStatus as PipelineStatus);
    const nextIdx = PIPELINE_ORDER.indexOf(next.status as PipelineStatus);
    if (nextIdx === -1 || nextIdx <= currentIdx) throw new BadRequestException('Invalid status — must move forward in the pipeline');

    if (next.status === 'complete') {
      const utr = next.utr?.trim();
      if (!utr) throw new BadRequestException('Enter the real UTR / transaction reference for this transfer');
      await update({ withdrawalStatus: 'complete', withdrawalPaidOut: true, withdrawalPaidUtr: utr });
      await this.prisma.payoutStatusEvent.create({ data: { payeeType, payeeId, ledgerTxId: row.id, status: 'complete', utr, staffEmail } });
      const user = await this.payeeUser(payeeType, payeeId);
      if (user) await this.email.sendTemplate(user.email, 'payout_processed', { name: user.name, amount: money(amount), role: payeeType }).catch(() => {});
      await this.notifications.notify('💸', `Withdrawal marked complete — ₹${amount.toLocaleString('en-IN')} · ${utr}`, '/admin/payments');
      return { ok: true };
    }

    // received / initiated / processed — pure status bookkeeping, no money
    // movement and no notification (the payee already got a 'requested'
    // email; the next one they get is 'complete' or 'rejected').
    await update({ withdrawalStatus: next.status });
    await this.prisma.payoutStatusEvent.create({ data: { payeeType, payeeId, ledgerTxId: row.id, status: next.status, staffEmail } });
    return { ok: true };
  }

  /** Marks a rejected withdrawal request's underlying issue as actually
   * followed up on (2026-09-18) — deliberately separate from the rejection
   * itself: 'rejected' is the terminal ledger state (the money's already
   * back in the payee's balance, nothing more to do there), but staff still
   * need a real way to track whether anyone actually chased down WHY it was
   * rejected — bad bank details, a duplicate request, a compliance question
   * — rather than a reason sitting in history that nobody's checked back
   * on. `note` is optional context for how it was resolved (e.g. "organizer
   * updated their bank details, confirmed by phone"). */
  async resolveRejection(payeeType: 'organizer' | 'venue', id: string, note: string | undefined, staffEmail: string) {
    if (payeeType === 'organizer') {
      const row = await this.prisma.organizerLedgerTx.findUnique({ where: { id } });
      if (!row || row.type !== 'withdrawal') throw new BadRequestException('Withdrawal request not found');
      if (row.withdrawalStatus !== 'rejected') throw new BadRequestException('This request was never rejected');
      if (row.withdrawalRejectionResolved) throw new BadRequestException('Already marked resolved');
      await this.prisma.organizerLedgerTx.update({ where: { id }, data: { withdrawalRejectionResolved: true } });
      await this.prisma.payoutStatusEvent.create({ data: { payeeType, payeeId: row.organizerId, ledgerTxId: id, status: 'rejection_resolved', reason: note?.trim() || undefined, staffEmail } });
      return { ok: true };
    }
    const row = await this.prisma.venueLedgerTx.findUnique({ where: { id } });
    if (!row || row.type !== 'withdrawal') throw new BadRequestException('Withdrawal request not found');
    if (row.withdrawalStatus !== 'rejected') throw new BadRequestException('This request was never rejected');
    if (row.withdrawalRejectionResolved) throw new BadRequestException('Already marked resolved');
    await this.prisma.venueLedgerTx.update({ where: { id }, data: { withdrawalRejectionResolved: true } });
    await this.prisma.payoutStatusEvent.create({ data: { payeeType, payeeId: row.venueId, ledgerTxId: id, status: 'rejection_resolved', reason: note?.trim() || undefined, staffEmail } });
    return { ok: true };
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
