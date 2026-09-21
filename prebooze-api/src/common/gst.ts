/** Prebooze's own GST registration state (Form GST REG-06, GSTIN
 * 27FDXPG4610R1ZO, activated 2026-09-21) — the fixed reference point every
 * intra-state vs inter-state GST split is compared against. */
export const PREBOOZE_GST_STATE = 'Maharashtra';

export interface GstBreakdown {
  gstPct: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
}

/** Standard Indian GST split: same state as the supplier (Prebooze,
 * Maharashtra) charges CGST+SGST (half each); a different state charges a
 * single IGST line instead — both sum to the same total gstPct either way,
 * only the invoice's line-item labels differ. An unknown/unresolved buyer
 * state defaults to same-state (CGST+SGST) rather than guessing IGST — the
 * total tax collected is identical, so this only risks a wrong label, never
 * a wrong amount, and same-state is the safer assumption given most of
 * Prebooze's own traffic is Maharashtra-based (Nagpur). */
export function computeGst(baseAmount: number, gstPct: number, buyerState: string | null | undefined): GstBreakdown {
  const gstAmount = Math.round((baseAmount * gstPct) / 100);
  const sameState = !buyerState || buyerState.trim().toLowerCase() === PREBOOZE_GST_STATE.toLowerCase();
  if (sameState) {
    const half = Math.round(gstAmount / 2);
    return { gstPct, gstAmount, cgstAmount: half, sgstAmount: gstAmount - half, igstAmount: 0 };
  }
  return { gstPct, gstAmount, cgstAmount: 0, sgstAmount: 0, igstAmount: gstAmount };
}

export const zeroGst = (gstPct = 0): GstBreakdown => ({ gstPct, gstAmount: 0, cgstAmount: 0, sgstAmount: 0, igstAmount: 0 });
