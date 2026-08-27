import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RazorpayService } from '../payments/razorpay.service';

@Injectable()
export class SettlementsService {
  private readonly log = new Logger('Settlements');

  constructor(
    private prisma: PrismaService,
    private razorpay: RazorpayService,
  ) {}

  async list() {
    const settlements = await this.prisma.razorpaySettlement.findMany({ orderBy: { settledAt: 'desc' } });
    const total = settlements.reduce((a, s) => a + s.amount, 0);
    return { settlements, total };
  }

  /** Paginates through Razorpay's real settlements until a page comes back
   * with nothing new (every id already cached) — cheap re-syncs once the
   * initial backfill has caught up, since settlements only ever get added,
   * never edited. */
  async sync() {
    if (!this.razorpay.live) return { synced: 0 };
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
    return { synced };
  }
}
