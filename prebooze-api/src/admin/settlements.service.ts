import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { calculateGatewayFee, type PaymentMethod } from '../payments/gateway-fee';

@Injectable()
export class SettlementsService {
  private readonly log = new Logger('Settlements');

  private razorpay: any = null;
  constructor(
    private prisma: PrismaService,
    
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

  /** Upserted by a real settlement.initiated/processed/attempt.failed
   * webhook (PhonePeWebhookController) — the genuinely automatic
   * counterpart to the CSV import below, mirroring how Razorpay's own
   * settlements need no manual step. `amount` arrives in paise, same
   * convention as every other PhonePe amount in this codebase. */
  async upsertPhonePeSettlement(data: {
    settlementId: string; state: string; utr: string; amountPaise: number;
    merchantId: string; lastAttemptErrorCode: string; lastAttemptErrorDescription: string; lastUpdatedAt: number;
  }) {
    if (!data.settlementId) return;
    await this.prisma.phonePeSettlement.upsert({
      where: { id: data.settlementId },
      create: {
        id: data.settlementId,
        amount: data.amountPaise / 100,
        state: data.state,
        utr: data.utr || null,
        merchantId: data.merchantId || null,
        lastAttemptErrorCode: data.lastAttemptErrorCode || null,
        lastAttemptErrorDescription: data.lastAttemptErrorDescription || null,
        settledAt: new Date(data.lastUpdatedAt),
      },
      update: {
        amount: data.amountPaise / 100,
        state: data.state,
        utr: data.utr || null,
        lastAttemptErrorCode: data.lastAttemptErrorCode || null,
        lastAttemptErrorDescription: data.lastAttemptErrorDescription || null,
        settledAt: new Date(data.lastUpdatedAt),
      },
    });
    this.log.log(`PhonePe settlement webhook: ${data.settlementId} -> ${data.state}`);
  }

  async listPhonePe() {
    const files = await this.prisma.phonePeSettlementFile.findMany({
      where: { status: 'RECONCILED' },
      orderBy: { fileDate: 'desc' },
      include: { items: { take: 5 } }, // Preview first 5 items
    });
    // Real, automatic settlement batches from PhonePe's own webhook — see
    // upsertPhonePeSettlement's doc comment. Only PROCESSED ones count
    // toward the settled total, same as Razorpay's own settlements are
    // implicitly "done" the moment they're synced.
    const autoSettlements = await this.prisma.phonePeSettlement.findMany({ orderBy: { settledAt: 'desc' } });

    const fileTotal = files.reduce((sum, f) => sum + f.totalAmount, BigInt(0));
    const autoTotal = autoSettlements.filter((s) => s.state === 'PROCESSED').reduce((sum, s) => sum + s.amount, 0);
    // Real bug fixed 2026-09-24: PhonePeSettlementFile/Item store amounts as
    // Prisma BigInt (paise), and this returned the raw rows straight through
    // — Express's JSON serializer throws "Do not know how to serialize a
    // BigInt" on any real row, 500ing this endpoint the moment a real
    // import ever succeeded (never caught before because the frontend
    // upload bug meant no import had ever actually gone through). Same
    // Number-conversion detailPhonePe already does correctly below.
    const settlements = files.map((f) => ({
      ...f,
      totalAmount: Number(f.totalAmount) / 100,
      totalFee: Number(f.totalFee) / 100,
      totalGST: Number(f.totalGST) / 100,
      items: f.items.map((i) => ({ ...i, amount: Number(i.amount) / 100, fee: Number(i.fee) / 100, gst: Number(i.gst) / 100 })),
    }));
    return {
      settlements,
      total: Number(fileTotal) / 100 + autoTotal, // Convert paise to rupees for display
      auto: autoSettlements,
      autoTotal,
    };
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

  /** One line of a real PhonePe settlement CSV export → array of fields,
   * honouring quoted values (customer_name/paylink_description can contain
   * commas) — the previous naive `.split(',')` would have silently
   * misaligned every column on the first such row. */
  private parseCsvLine(line: string): string[] {
    const out: string[] = [];
    let cur = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQuotes = false;
        else cur += ch;
      } else if (ch === '"') inQuotes = true;
      else if (ch === ',') { out.push(cur); cur = ''; }
      else cur += ch;
    }
    out.push(cur);
    return out.map((s) => s.trim());
  }

  /** Matches PhonePe's real settlement CSV export exactly (column names
   * confirmed 2026-09-24 against a real downloaded file — this app's
   * importer previously assumed an invented `payment_id, amount, fee,
   * gst, payment_method` shape that never matched anything PhonePe
   * actually produces, so no real import had ever succeeded before this).
   * `transaction_amount`/`total_fees`/`total_tax` are decimal RUPEES
   * (e.g. "3294.00"), not paise — confirmed against a real row. `booking_id`/
   * `featured_id` aren't real columns in PhonePe's export at all; instead
   * this looks each row's `merchant_order_id` up against Booking.paymentId
   * / Featured.phonepeMerchantOrderId directly, so nothing needs to be
   * hand-annotated before upload. Refund rows (transaction_type containing
   * "REFUND") are skipped — those are already tracked for real via
   * PhonePeWebhookController's pg.refund.* handling, and including them
   * here too would double-count the same money. */
  async importPhonePeSettlementFile(csvContent: string, filename: string) {
    const lines = csvContent.split(/\r?\n/).filter((line) => line.trim());
    if (lines.length < 2) throw new BadRequestException('Settlement file is empty');

    const headers = this.parseCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
    const idx = (name: string) => headers.indexOf(name);
    const merchantOrderIdIdx = idx('merchant_order_id');
    const amountIdx = idx('transaction_amount');
    const feeIdx = idx('total_fees');
    const taxIdx = idx('total_tax');
    const instrumentIdx = idx('instrument');
    const modeIdx = idx('mode');
    const statusIdx = idx('transaction_status');
    const typeIdx = idx('transaction_type');
    const settlementDateIdx = idx('settlement_date');

    if (merchantOrderIdIdx === -1 || amountIdx === -1 || statusIdx === -1) {
      throw new BadRequestException(
        `CSV missing required columns. Found headers: [${headers.join(', ')}] — expected at least: merchant_order_id, transaction_amount, transaction_status (PhonePe's real settlement export)`,
      );
    }

    const toPaise = (v: string | undefined) => BigInt(Math.round(parseFloat(v || '0') * 100) || 0);

    const records: Array<{
      paymentId: string; amount: bigint; fee: bigint; gst: bigint; paymentMethod: string; settlementDate: string;
    }> = [];
    let skippedRefunds = 0;
    let skippedNotCompleted = 0;

    for (let i = 1; i < lines.length; i++) {
      const cols = this.parseCsvLine(lines[i]);
      if (!cols[merchantOrderIdIdx]) continue;
      if (typeIdx !== -1 && cols[typeIdx]?.toUpperCase().includes('REFUND')) { skippedRefunds++; continue; }
      if (cols[statusIdx]?.toUpperCase() !== 'COMPLETED') { skippedNotCompleted++; continue; }

      records.push({
        paymentId: cols[merchantOrderIdIdx],
        amount: toPaise(cols[amountIdx]),
        fee: feeIdx !== -1 ? toPaise(cols[feeIdx]) : BigInt(0),
        gst: taxIdx !== -1 ? toPaise(cols[taxIdx]) : BigInt(0),
        paymentMethod: (cols[instrumentIdx] || cols[modeIdx] || 'UNKNOWN').toUpperCase(),
        settlementDate: settlementDateIdx !== -1 ? cols[settlementDateIdx] : '',
      });
    }

    if (records.length === 0) {
      throw new BadRequestException(
        `No settled (COMPLETED, non-refund) records found in this file — ${skippedRefunds} refund row(s) and ${skippedNotCompleted} non-completed row(s) skipped.`,
      );
    }

    // Auto-link to real bookings/featured purchases by merchant_order_id —
    // PhonePe's export has no booking_id/featured_id column, but every
    // PhonePe booking's Booking.paymentId (and Featured/MarketingOrder's
    // phonepeMerchantOrderId) already IS the merchant_order_id, so this
    // needs no manual annotation.
    const orderIds = [...new Set(records.map((r) => r.paymentId))];
    const [bookings, featured] = await Promise.all([
      this.prisma.booking.findMany({ where: { paymentId: { in: orderIds } }, select: { id: true, paymentId: true } }),
      this.prisma.featured.findMany({ where: { phonepeMerchantOrderId: { in: orderIds } }, select: { id: true, phonepeMerchantOrderId: true } }),
    ]);
    const bookingByOrderId = new Map(bookings.map((b) => [b.paymentId!, b.id]));
    const featuredByOrderId = new Map(featured.map((f) => [f.phonepeMerchantOrderId!, f.id]));

    // Prefer the row's own settlement_date (when the bank actually paid
    // out) over the filename — PhonePe's real export names files by
    // download date, not the settlement it covers, so parsing the
    // filename would have been wrong every time.
    const firstSettlementDate = records.find((r) => r.settlementDate)?.settlementDate;
    const fileDate = firstSettlementDate ? new Date(firstSettlementDate) : new Date();

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
          paymentId: record.paymentId,
          amount: record.amount,
          fee: record.fee,
          gst: record.gst,
          paymentMethod: record.paymentMethod as any,
          bookingId: bookingByOrderId.get(record.paymentId) || null,
          featuredId: featuredByOrderId.get(record.paymentId) || null,
        },
      });
    }

    // Mark as reconciled
    await this.prisma.phonePeSettlementFile.update({
      where: { id: settlementFile.id },
      data: { status: 'RECONCILED' },
    });

    const linkedCount = records.filter((r) => bookingByOrderId.has(r.paymentId) || featuredByOrderId.has(r.paymentId)).length;
    this.log.log(`PhonePe settlement import: ${records.length} items from ${filename} (${linkedCount} auto-linked, ${skippedRefunds} refund/${skippedNotCompleted} non-completed rows skipped)`);

    return {
      ok: true,
      fileId: settlementFile.id,
      recordsImported: records.length,
      recordsLinked: linkedCount,
      skippedRefunds,
      skippedNotCompleted,
      totalAmount: Number(settlementFile.totalAmount) / 100,
      totalFee: Number(settlementFile.totalFee) / 100,
      totalGST: Number(settlementFile.totalGST) / 100,
    };
  }

  /** Reconcile estimated fees (posted at booking time) vs actual fees from PhonePe settlement.
   * For each booking in the settlement, compares what was estimated during booking creation
   * against what PhonePe actually charged. Creates adjustment entries for discrepancies. */
  async reconcilePhonePeFeesAgainstSettlement(settlementFileId: string): Promise<{
    bookingsReconciled: number;
    totalEstimatedFee: number;
    totalActualFee: number;
    discrepancies: Array<{ bookingId: string; estimated: number; actual: number; adjustment: number }>;
  }> {
    const file = await this.prisma.phonePeSettlementFile.findUnique({
      where: { id: settlementFileId },
      include: { items: true },
    });

    if (!file) throw new NotFoundException('Settlement file not found');

    const discrepancies: Array<{
      bookingId: string;
      estimated: number;
      actual: number;
      adjustment: number;
    }> = [];
    let totalEstimatedFee = 0;
    let totalActualFee = 0;

    // Get all bookings referenced in this settlement
    const bookingIds = file.items
      .filter((i) => i.bookingId)
      .map((i) => i.bookingId!);

    if (bookingIds.length === 0) {
      this.log.log(`Settlement ${settlementFileId} has no bookings to reconcile`);
      return {
        bookingsReconciled: 0,
        totalEstimatedFee: 0,
        totalActualFee: 0,
        discrepancies: [],
      };
    }

    const bookings = await this.prisma.booking.findMany({
      where: { id: { in: bookingIds } },
      select: { id: true, total: true, eventId: true, event: { select: { title: true } } },
    });

    const bookingMap = new Map(bookings.map((b) => [b.id, b]));

    // For each settlement item, calculate estimated vs actual fees
    for (const item of file.items) {
      if (!item.bookingId) continue;

      const booking = bookingMap.get(item.bookingId);
      if (!booking) continue;

      // Estimated fee is what was posted to ledger during booking creation
      // We estimate it using the same logic: calculateGatewayFee with the booking amount
      const { baseFee: estimatedFee } = calculateGatewayFee(
        booking.total * 100,
        'PHONEPE',
        (item.paymentMethod as PaymentMethod) || 'UPI',
      );

      const actualFee = Number(item.fee) / 100; // Convert paise to rupees
      totalEstimatedFee += estimatedFee / 100; // Convert paise to rupees
      totalActualFee += actualFee;

      if (Math.abs(estimatedFee - Number(item.fee)) > 1) {
        // More than 1 paise difference = discrepancy
        discrepancies.push({
          bookingId: item.bookingId,
          estimated: estimatedFee / 100,
          actual: actualFee,
          adjustment: actualFee - estimatedFee / 100,
        });

        // If there's a discrepancy, post an adjustment entry
        if (discrepancies.length > 0 && Math.abs(estimatedFee - Number(item.fee)) > 1) {
          const adjustment = Number(item.fee) - estimatedFee;
          if (adjustment !== 0) {
            await this.prisma.ledgerEntry.create({
              data: {
                kind: adjustment > 0 ? 'expense' : 'income',
                category: 'Payment gateway fee adjustment',
                amount: Math.abs(adjustment),
                note: `Reconciliation: Booking ${item.bookingId} settlement fee adjustment from PhonePe (settlement: ${settlementFileId})`,
                auto: true,
                eventId: booking.eventId,
              },
            });
          }
        }
      }
    }

    this.log.log(
      `Fee reconciliation complete for settlement ${settlementFileId}: ` +
        `${bookingIds.length} bookings, ${discrepancies.length} discrepancies found`,
    );

    return {
      bookingsReconciled: bookingIds.length,
      totalEstimatedFee,
      totalActualFee,
      discrepancies,
    };
  }
}
