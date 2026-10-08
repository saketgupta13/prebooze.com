import { computeGst, PREBOOZE_GST_STATE, type GstBreakdown } from './gst';

export interface PayoutBreakdown {
  preTcsCredit: number;
  commissionAmt: number;
  // Prebooze's own real taxable supply (facilitation service to the
  // organizer/venue) — additional to commissionAmt, never carved out of
  // it. Zero whenever gstEnabled is false (or commissionAmt is 0 — a
  // promoter-markup-funded sale deducts no commission at all, so there's
  // nothing to tax), same kill switch as every other GST in this codebase.
  commissionGst: GstBreakdown;
  // Withheld under the organizer/venue's OWN GSTIN (GST Act s.52) — on the
  // real ticket sale value (ticketSubtotal), never Prebooze's commission
  // and never whatever organizerCredit happens to be after a promoter
  // markup. Not Prebooze's income or expense, just pass-through held until
  // deposited under their registration. Zero whenever tcsEnabled is false
  // (no registration in that state yet to deposit it against).
  tcsAmount: number;
  tcsCgstAmount: number;
  tcsSgstAmount: number;
  tcsIgstAmount: number;
  // What the organizer/venue actually receives — preTcsCredit minus
  // commission GST and TCS. This is the real number that changes the
  // moment either gets switched on; every payout-facing screen must show
  // this breakdown, not just a bare "net", so nobody is surprised by a
  // lower transfer than before.
  net: number;
}

/** The one place commission-GST/TCS math happens — every screen that shows
 * "how much will this payee receive" (admin's due-list, payee detail, the
 * organizer/venue's own payout view), the actual settlement
 * (PaymentsService.markPaid), AND the moment a sale is first credited
 * (BookingsService, every type:'sale' ledger entry) must all call this
 * exact function. The last one matters as much as the first: an organizer/
 * venue's ledger balance is also what a self-serve withdrawal reads from,
 * independent of admin's own payout screen — crediting the pre-GST/TCS
 * figure at sale time and only deducting at markPaid() would let someone
 * self-withdraw the GST/TCS portion before admin ever gets to it. Never
 * recompute this math inline at a call site the way several used to before
 * commission-GST/TCS existed — that duplication is exactly how a shown
 * "due" amount could drift from what actually got paid.
 *
 * Unlike commission GST, TCS does NOT charge the same total rate both ways
 * — tcsPct (0.5% by default) is the INTRA-state rate (payee in Maharashtra,
 * split 0.25% CGST + 0.25% SGST); a payee in any other state is charged
 * double that as a single IGST line (1% by default). This mirrors the two
 * separate GST TCS rate notifications (52/2018-Central Tax for intra-state,
 * 02/2018-Integrated Tax for inter-state) rather than reusing computeGst's
 * same-rate-different-split model, which only fits ordinary GST. */
export function computePayoutBreakdown(params: {
  // What would be credited before any TCS deduction — organizerCredit in
  // the booking context (subtotal-commission normally, or baseSubtotal in
  // full when a promoter markup funded the commission separately).
  preTcsCredit: number;
  // The real ticket sale value TCS withholds against (GST Act s.52's "net
  // value of taxable supply") — always the actual subtotal the guest paid
  // for the ticket itself, regardless of which of the above funded the
  // organizer's commission.
  ticketSubtotal: number;
  // The real rupee commission already deducted for this sale — passed in
  // directly rather than re-derived from a % here, since every call site
  // already has this exact figure computed (sometimes 0 — see
  // PayoutBreakdown.commissionGst's own doc comment).
  commissionAmt: number;
  payeeState: string | null | undefined;
  gstEnabled: boolean;
  commissionGstPct: number;
  tcsEnabled: boolean;
  tcsPct: number;
}): PayoutBreakdown {
  const { preTcsCredit, ticketSubtotal, commissionAmt, payeeState, gstEnabled, commissionGstPct, tcsEnabled, tcsPct } = params;
  const commissionGst = gstEnabled && commissionAmt > 0 ? computeGst(commissionAmt, commissionGstPct, payeeState) : { gstPct: 0, gstAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 };
  const tcsSameState = !payeeState || payeeState.trim().toLowerCase() === PREBOOZE_GST_STATE.toLowerCase();
  // Inter-state TCS is double the intra-state rate (1% vs 0.5% by default),
  // not just a different split of the same rate — see this function's own
  // doc comment for why computeGst's model doesn't apply here.
  const tcsRate = tcsSameState ? tcsPct : tcsPct * 2;
  const tcsAmount = tcsEnabled ? Math.round((ticketSubtotal * tcsRate) / 100) : 0;
  const tcsHalf = tcsSameState ? Math.round(tcsAmount / 2) : 0;
  const tcsCgstAmount = tcsSameState ? tcsHalf : 0;
  const tcsSgstAmount = tcsSameState ? tcsAmount - tcsHalf : 0;
  const tcsIgstAmount = tcsSameState ? 0 : tcsAmount;
  const net = preTcsCredit - commissionGst.gstAmount - tcsAmount;
  return { preTcsCredit, commissionAmt, commissionGst, tcsAmount, tcsCgstAmount, tcsSgstAmount, tcsIgstAmount, net };
}
