import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RazorpayService } from '../payments/razorpay.service';

@Injectable()
export class SettlementsService {
  private readonly log = new Logger('Settlements');

  constructor(
    private prisma: PrismaService,
    private razorpay: RazorpayService,
  ) {}

  /** This Razorpay account had real activity on it before Prebooze ever
   * used it — settlements from before the very first real booking are
   * someone else's money, not ours, and shouldn't show here at all. */
  private async firstBookingDate(): Promise<Date> {
    const first = await this.prisma.booking.findFirst({ where: { paymentId: { not: null } }, orderBy: { createdAt: 'asc' }, select: { createdAt: true } });
    return first?.createdAt ?? new Date(0);
  }

  async list() {
    const since = await this.firstBookingDate();
    const settlements = await this.prisma.razorpaySettlement.findMany({ where: { settledAt: { gte: since } }, orderBy: { settledAt: 'desc' } });
    const total = settlements.reduce((a, s) => a + s.amount, 0);
    return { settlements, total };
  }

  /** Real per-payment breakdown for one settlement — Razorpay's cut
   * (fee - tax) vs GST (tax) vs what actually landed, plus the real
   * bookings that made up this batch, cross-referenced by paymentId. */
  async detail(id: string) {
    const settlement = await this.prisma.razorpaySettlement.findUnique({ where: { id } });
    if (!settlement) throw new NotFoundException('Settlement not found');

    const items = await this.prisma.razorpaySettlementItem.findMany({ where: { settlementId: id }, orderBy: { paidAt: 'desc' } });
    const paymentIds = items.map((i) => i.id);
    const bookings = paymentIds.length
      ? await this.prisma.booking.findMany({ where: { paymentId: { in: paymentIds } }, select: { id: true, paymentId: true, mainGuest: true, eventId: true, event: { select: { title: true } } } })
      : [];
    const bookingByPaymentId = new Map(bookings.map((b) => [b.paymentId, b]));

    const payments = items.map((i) => {
      const b = bookingByPaymentId.get(i.id);
      return {
        paymentId: i.id, amount: i.amount, razorpayCut: i.fee - i.tax, gstCut: i.tax, net: i.amount - i.fee, paidAt: i.paidAt,
        bookingId: b?.id ?? null, guestName: b?.mainGuest ?? null, eventTitle: b?.event.title ?? null,
      };
    });

    const grossTotal = items.reduce((a, i) => a + i.amount, 0);
    const razorpayCutTotal = items.reduce((a, i) => a + (i.fee - i.tax), 0);
    const gstCutTotal = items.reduce((a, i) => a + i.tax, 0);

    return { settlement, payments, grossTotal, razorpayCutTotal, gstCutTotal, feeTotal: razorpayCutTotal + gstCutTotal };
  }

  /** Paginates through Razorpay's real settlements until a page comes back
   * with nothing new (every id already cached) — cheap re-syncs once the
   * initial backfill has caught up, since settlements only ever get added,
   * never edited. */
  async sync() {
    if (!this.razorpay.live) return { synced: 0, items: 0 };
    let skip = 0;
    let synced = 0;
    const count = 100;
    for (;;) {
      const page = await this.razorpay.listSettlements(skip, count);
      if (!page.length) break;
      let anyNew = false;
      for (const s of page) {
        const existing = await this.prisma.razorpaySettlement.findUnique({ where: { id: s.id } });
        if (!existing) anyNew = true;
        await this.prisma.razorpaySettlement.upsert({
          where: { id: s.id },
          create: { id: s.id, amount: s.amount, status: s.status, utr: s.utr, settledAt: s.settledAt },
          update: { amount: s.amount, status: s.status, utr: s.utr },
        });
        synced++;
      }
      if (page.length < count || !anyNew) break;
      skip += count;
    }
    if (synced) this.log.log(`Settlements sync: ${synced} record(s) up to date`);

    const items = await this.syncReconItems();
    return { synced, items };
  }

  /** The exact payment→settlement/fee/tax breakdown, from Razorpay's own
   * month-scoped reconciliation report — walks every month from the first
   * real booking to the current one. Cheap to re-run: only inserts items
   * that don't already exist (a payment's fee/tax never changes once set). */
  private async syncReconItems(): Promise<number> {
    const since = await this.firstBookingDate();
    const now = new Date();
    let inserted = 0;
    for (let y = since.getFullYear(); y <= now.getFullYear(); y++) {
      const startMonth = y === since.getFullYear() ? since.getMonth() + 1 : 1;
      const endMonth = y === now.getFullYear() ? now.getMonth() + 1 : 12;
      for (let m = startMonth; m <= endMonth; m++) {
        const items = await this.razorpay.listSettlementRecon(y, m).catch(() => []);
        for (const i of items) {
          if (i.type !== 'payment') continue; // refunds/adjustments not shown here — see RazorpaySettlementItem's doc comment
          const existing = await this.prisma.razorpaySettlementItem.findUnique({ where: { id: i.id } });
          if (existing) continue;
          await this.prisma.razorpaySettlementItem.create({
            data: { id: i.id, settlementId: i.settlementId, amount: i.amount, fee: i.fee, tax: i.tax, paidAt: i.paidAt },
          });
          inserted++;
        }
      }
    }
    if (inserted) this.log.log(`Settlement recon sync: ${inserted} item(s)`);
    return inserted;
  }
}
