import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { RazorpayService } from '../payments/razorpay.service';
import { calculateGatewayFee, type PaymentMethod } from '../payments/gateway-fee';

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

  // ============================================================================
  // PhonePe settlements — CSV-based async model (T+1/T+2 payout cycle)
  // ============================================================================

  async listPhonePe() {
    const files = await this.prisma.phonePeSettlementFile.findMany({
      where: { status: 'RECONCILED' },
      orderBy: { fileDate: 'desc' },
      include: { items: { take: 5 } }, // Preview first 5 items
    });

    const total = files.reduce((sum, f) => sum + f.totalAmount, BigInt(0));
    return { settlements: files, total: Number(total) / 100 }; // Convert paise to rupees for display
  }

  async detailPhonePe(fileId: string) {
    const file = await this.prisma.phonePeSettlementFile.findUnique({
      where: { id: fileId },
      include: { items: true },
    });

    if (!file) throw new NotFoundException('PhonePe settlement file not found');

    // Group by payment method for breakdown
    const byMethod = new Map<string, { count: number; amount: bigint; fee: bigint; gst: bigint }>();
    for (const item of file.items) {
      const method = item.paymentMethod || 'UNKNOWN';
      const current = byMethod.get(method) ?? { count: 0, amount: BigInt(0), fee: BigInt(0), gst: BigInt(0) };
      byMethod.set(method, {
        count: current.count + 1,
        amount: current.amount + item.amount,
        fee: current.fee + item.fee,
        gst: current.gst + item.gst,
      });
    }

    const methodBreakdown = Array.from(byMethod.entries()).map(([method, data]) => ({
      paymentMethod: method,
      transactionCount: data.count,
      totalAmount: Number(data.amount) / 100,
      totalFee: Number(data.fee) / 100,
      totalGST: Number(data.gst) / 100,
    }));

    // Payment details
    const payments = file.items.map((i) => ({
      paymentId: i.paymentId,
      amount: Number(i.amount) / 100,
      fee: Number(i.fee) / 100,
      gst: Number(i.gst) / 100,
      paymentMethod: i.paymentMethod,
      bookingId: i.bookingId,
      featuredId: i.featuredId,
    }));

    return {
      file: {
        id: file.id,
        fileDate: file.fileDate,
        downloadedAt: file.downloadedAt,
        filename: file.filename,
        status: file.status,
      },
      totals: {
        amount: Number(file.totalAmount) / 100,
        fee: Number(file.totalFee) / 100,
        gst: Number(file.totalGST) / 100,
      },
      methodBreakdown,
      payments,
    };
  }

  async importPhonePeSettlementFile(csvContent: string, filename: string) {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) throw new Error('Settlement file is empty');

    // Parse CSV header (expects: payment_id, amount, fee, gst, payment_method, booking_id, featured_id)
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const paymentIdIdx = headers.indexOf('payment_id');
    const amountIdx = headers.indexOf('amount');
    const feeIdx = headers.indexOf('fee');
    const gstIdx = headers.indexOf('gst');
    const methodIdx = headers.indexOf('payment_method');
    const bookingIdIdx = headers.indexOf('booking_id');
    const featuredIdIdx = headers.indexOf('featured_id');

    if (paymentIdIdx === -1 || amountIdx === -1 || feeIdx === -1 || gstIdx === -1 || methodIdx === -1) {
      throw new Error('CSV missing required columns: payment_id, amount, fee, gst, payment_method');
    }

    // Parse records
    const records: Array<{
      payment_id: string;
      amount: bigint;
      fee: bigint;
      gst: bigint;
      payment_method: string;
      booking_id?: string;
      featured_id?: string;
    }> = [];

    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(',').map(c => c.trim());
      if (!cols[paymentIdIdx]) continue;

      records.push({
        payment_id: cols[paymentIdIdx],
        amount: BigInt(cols[amountIdx] || '0'),
        fee: BigInt(cols[feeIdx] || '0'),
        gst: BigInt(cols[gstIdx] || '0'),
        payment_method: cols[methodIdx] || 'UNKNOWN',
        booking_id: cols[bookingIdIdx] || undefined,
        featured_id: cols[featuredIdIdx] || undefined,
      });
    }

    if (records.length === 0) throw new Error('No records found in settlement file');

    // Extract file date from filename (expect format: settlement_YYYY_MM_DD.csv or similar)
    const dateMatch = filename.match(/(\d{4})[-_](\d{2})[-_](\d{2})/);
    const fileDate = dateMatch ? new Date(`${dateMatch[1]}-${dateMatch[2]}-${dateMatch[3]}`) : new Date();

    // Create settlement file
    const settlementFile = await this.prisma.phonePeSettlementFile.create({
      data: {
        fileDate,
        downloadedAt: new Date(),
        filename,
        totalAmount: records.reduce((sum, r) => sum + r.amount, BigInt(0)),
        totalFee: records.reduce((sum, r) => sum + r.fee, BigInt(0)),
        totalGST: records.reduce((sum, r) => sum + r.gst, BigInt(0)),
        status: 'PROCESSING',
      },
    });

    // Create settlement items
    for (const record of records) {
      await this.prisma.phonePeSettlementItem.create({
        data: {
          settlementFileId: settlementFile.id,
          paymentId: record.payment_id,
          amount: record.amount,
          fee: record.fee,
          gst: record.gst,
          paymentMethod: record.payment_method as any,
          bookingId: record.booking_id || null,
          featuredId: record.featured_id || null,
        },
      });
    }

    // Mark as reconciled
    await this.prisma.phonePeSettlementFile.update({
      where: { id: settlementFile.id },
      data: { status: 'RECONCILED' },
    });

    this.log.log(`PhonePe settlement import: ${records.length} items from ${filename}`);

    return {
      ok: true,
      fileId: settlementFile.id,
      recordsImported: records.length,
      totalAmount: Number(settlementFile.totalAmount) / 100,
      totalFee: Number(settlementFile.totalFee) / 100,
      totalGST: Number(settlementFile.totalGST) / 100,
    };
  }

  /**
   * Fee reconciliation: compare estimated fees (posted at booking time) vs actual fees (from settlement).
   * This is a future enhancement. For now, estimated fees are posted at booking creation and can be
   * manually reviewed against the settlement file details for discrepancies.
   *
   * Implementation notes for future:
   * - Query LedgerEntry for 'Payment gateway fee' category with bookingId
   * - Compare estimated amount vs actual amount from PhonePeSettlementItem
   * - Post 'Payment gateway fee adjustment' entries for discrepancies
   * - Requires linking LedgerEntry to bookings (may need schema change)
   */
  async reconcilePhonePeFeesAgainstSettlement(settlementFileId: string): Promise<void> {
    this.log.log(`Fee reconciliation for settlement ${settlementFileId}: placeholder for future implementation`);
  }
}
