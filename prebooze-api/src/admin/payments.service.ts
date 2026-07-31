import { BadRequestException, Injectable } from '@nestjs/common';
import type { BookingStatus } from '@prisma/client';
import { PrismaService } from '../prisma.service';
import { NotificationsService } from './notifications.service';

const LIVE_BOOKING_STATUSES: BookingStatus[] = ['confirmed', 'refund_requested'];

/** prebooze-admin's /payments page — distinct from Reports (platform P&L)
 * and Ledger (internal income/expense book): this is the per-event,
 * per-organizer payout register with a literal "run the batch" action.
 * Only the "Payouts due" tab is built — the mock's other three tabs
 * (Transactions, Refunds, Disputes) are its own self-admitted placeholders
 * ("coming with backend integration"), not something this slice reproduces. */
@Injectable()
export class PaymentsService {
  constructor(
    private prisma: PrismaService,
    private notifications: NotificationsService,
  ) {}

  async payoutsDue() {
    const settings = await this.prisma.platformSettings.upsert({ where: { id: 'main' }, update: {}, create: { id: 'main' } });
    // A payout is only ever due once the event has actually happened — an
    // organizer can't be paid out on ticket sales for a show that hasn't
    // run yet (see BACKEND.md — this used to include every non-draft event
    // regardless of date, which let the auto-payout cron mark events as
    // "paid" days before they even took place).
    const events = await this.prisma.event.findMany({
      where: { status: { not: 'draft' }, commission: { not: null } },
      select: { id: true, title: true, date: true, durationHrs: true, commission: true, paidOut: true, payoutUtr: true, organizer: { select: { brandName: true } } },
    }).then((rows) => rows.filter((e) => new Date(e.date).getTime() + e.durationHrs * 3600_000 <= Date.now()));
    const revenueByEvent = await this.prisma.booking.groupBy({
      by: ['eventId'],
      where: { status: { in: LIVE_BOOKING_STATUSES } },
      _sum: { subtotal: true },
    });
    const revMap = new Map(revenueByEvent.map((r) => [r.eventId, r._sum.subtotal ?? 0]));

    const rows = events.map((e) => {
      const revenue = revMap.get(e.id) ?? 0;
      const commissionAmt = Math.round((revenue * (e.commission as number)) / 100);
      const gst = Math.round((commissionAmt * settings.gstPct) / 100);
      return {
        id: e.id,
        title: e.title,
        organizer: e.organizer.brandName,
        revenue,
        commission: e.commission,
        commissionAmt,
        gst,
        net: revenue - commissionAmt - gst,
        paidOut: e.paidOut,
        payoutUtr: e.payoutUtr,
      };
    });

    const due = rows.filter((r) => !r.paidOut);
    const collected = rows.reduce((a, r) => a + r.revenue, 0);
    const commissionKept = rows.reduce((a, r) => a + r.commissionAmt, 0);
    const gstCollected = rows.reduce((a, r) => a + r.gst, 0);
    const dueTotal = due.reduce((a, r) => a + r.net, 0);

    return { rows, collected, commissionKept, gstCollected, dueTotal };
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
}
