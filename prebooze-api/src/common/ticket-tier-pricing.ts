/** Time-limited free entry — a tier priced ₹0 can carry a `freeCutoff`
 * ("HH:MM" on the event's own night, same absolute-datetime formula as
 * PromoterConfig.cutoff/promoter.service.ts's cutoffDate()) plus a required
 * `lateFeePrice`. Selling switches from free to `lateFeePrice` the instant
 * the cutoff passes — there's no grace period on the *price*. The 15-minute
 * grace (GRACE_MINUTES) is a gate/door concept only: guests who already
 * hold a free ticket bought before the cutoff may still be let in up to 15
 * min late, entirely at the organizer's discretion — Prebooze doesn't
 * guarantee or enforce it, and it has no bearing on what a *new* booking
 * costs. A tier with no freeCutoff set is untouched by any of this — every
 * tier that existed before this feature behaves exactly as before. */

export const GRACE_MINUTES = 15;

export interface TierPricingInput {
  price: number;
  freeCutoff: string | null;
  lateFeePrice: number | null;
}

export type TierWindowState = 'always' | 'free' | 'closed';

// Prebooze is India-only — "20:00" on an organizer's tier always means
// 8 PM IST, a fixed UTC+5:30 offset (India has no DST). Must NOT use
// Date's local setHours()/getHours() here: this same code runs on the
// server (UTC) and in every guest's browser (whatever timezone their
// device is set to) — local-time math would make "20:00" resolve to a
// different absolute instant on each side, silently shifting the real
// cutoff by hours depending on who's computing it. Date.UTC()/getUTC*
// are timezone-independent, so the IST offset is applied explicitly and
// by hand instead, giving every caller everywhere the same answer.
const IST_OFFSET_MIN = 5.5 * 60;

/** Same "HH:MM on event night, next day if earlier than start" formula as
 * lib/promoterPass.ts's cutoffDate() / promoter.service.ts's cutoffDate() —
 * but IST-anchored (see IST_OFFSET_MIN above) rather than local-time-based. */
export function tierCutoffDate(eventDate: Date, freeCutoff: string): Date {
  const eventIstMs = eventDate.getTime() + IST_OFFSET_MIN * 60000;
  const eventIst = new Date(eventIstMs);
  const [h, m] = freeCutoff.split(':').map(Number);
  const cutoffIst = new Date(Date.UTC(eventIst.getUTCFullYear(), eventIst.getUTCMonth(), eventIst.getUTCDate(), h, m, 0, 0));
  if (cutoffIst.getTime() < eventIst.getTime()) cutoffIst.setUTCDate(cutoffIst.getUTCDate() + 1);
  return new Date(cutoffIst.getTime() - IST_OFFSET_MIN * 60000);
}

/** Purely informational (see file doc comment) — not used by pricing. */
export function tierGraceEndDate(eventDate: Date, freeCutoff: string): Date {
  return new Date(tierCutoffDate(eventDate, freeCutoff).getTime() + GRACE_MINUTES * 60 * 1000);
}

export function tierWindowState(tier: TierPricingInput, eventDate: Date, now: Date = new Date()): TierWindowState {
  if (tier.price !== 0 || !tier.freeCutoff) return 'always';
  return now.getTime() < tierCutoffDate(eventDate, tier.freeCutoff).getTime() ? 'free' : 'closed';
}

/** The actual price to charge right now — never trust a client-supplied
 * price for this, always recompute server-side at quote/hold/create time. */
export function effectiveTierPrice(tier: TierPricingInput, eventDate: Date, now: Date = new Date()): number {
  return tierWindowState(tier, eventDate, now) === 'closed' ? (tier.lateFeePrice ?? tier.price) : tier.price;
}
