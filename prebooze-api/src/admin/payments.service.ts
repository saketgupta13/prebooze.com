import { BadRequestException, Injectable } from '@nestjs/common';
import type { BookingStatus, Event } from '@prisma/client';
import { randomInt } from 'crypto';
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
    const events = await this.prisma.event.findMany({
      where: { status: { not: 'draft' }, commission: { not: null } },
      select: { id: true, title: true, commission: true, paidOut: true, payoutUtr: true, organizer: { select: { brandName: true } } },
    });
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

  async runBatch(eventIds: string[]) {
    if (!eventIds?.length) throw new BadRequestException('Select at least one event to pay out');
    const utr = () => 'UTR' + randomInt(100000000, 999999999);

    const updated: Event[] = [];
    for (const id of eventIds) {
      const event = await this.prisma.event.findUnique({ where: { id } });
      if (!event || event.paidOut) continue;
      updated.push(await this.prisma.event.update({ where: { id }, data: { paidOut: true, payoutUtr: utr() } }));
    }

    if (updated.length) {
      await this.notifications.notify('💸', `Payout batch processed — ${updated.length} transfer${updated.length === 1 ? '' : 's'} initiated`, '/admin/payments');
    }
    return { ok: true, count: updated.length, events: updated };
  }
}
