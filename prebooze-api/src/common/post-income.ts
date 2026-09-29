import { PrismaService } from '../prisma.service';

/** Posts real Prebooze income to the ledger the same way BookingsService's
 * own postEventLedger does for ticket commission/fees — the single
 * mechanism Reports.otherIncome/totalIncome/netProfit actually reads from.
 * Marketing and Featured payments used to confirm and invoice correctly but
 * never post here at all, so real revenue from both products was silently
 * invisible in every financial report since launch — this is the fix for
 * that gap, reused by both services rather than each reimplementing it.
 *
 * When `eventId` is given, mirrors postEventLedger exactly: an upserted,
 * accumulating row keyed by (eventId, category) — safe to call once per
 * paid order without double-counting if ever called twice for the same
 * event+category. When there's no real event to key against (a Featured
 * placement on an organizer/promoter/lineup/venue profile, not an event),
 * inserts a plain one-off row instead — there's no natural accumulation key
 * for those the way there is for repeat ticket sales on the same event. */
export async function postIncome(
  prisma: PrismaService,
  params: { category: string; amount: number; note: string; eventId?: string | null },
) {
  const { category, amount, note, eventId } = params;
  if (amount <= 0) return;
  if (eventId) {
    await prisma.ledgerEntry.upsert({
      where: { eventId_category: { eventId, category } },
      create: { kind: 'income', category, amount, note, eventId, auto: true },
      update: { amount: { increment: amount } },
    });
  } else {
    await prisma.ledgerEntry.create({ data: { kind: 'income', category, amount, note, auto: true } });
  }
}
