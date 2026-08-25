/** Time-limited free entry — a tier priced ₹0 can carry a `freeCutoff`
 * ("HH:MM" on the event's own night, same absolute-datetime formula as
 * PromoterConfig.cutoff/promoter.service.ts's cutoffDate()) plus a fixed
 * 15-minute grace period. Before the cutoff and during grace it's still
 * free; after grace it becomes a normal paid tier at `lateFeePrice`. A
 * tier with no freeCutoff set is untouched by any of this — every tier
 * that existed before this feature behaves exactly as before. */

const GRACE_MINUTES = 15;

export interface TierPricingInput {
  price: number;
  freeCutoff: string | null;
  lateFeePrice: number | null;
}

export type TierWindowState = 'always' | 'free' | 'grace' | 'closed';

/** Same "HH:MM on event night, next day if earlier than start" formula as
 * lib/promoterPass.ts's cutoffDate() / promoter.service.ts's cutoffDate(). */
export function tierCutoffDate(eventDate: Date, freeCutoff: string): Date {
  const [h, m] = freeCutoff.split(':').map(Number);
  const c = new Date(eventDate);
  c.setHours(h, m, 0, 0);
  if (c.getTime() < eventDate.getTime()) c.setDate(c.getDate() + 1);
  return c;
}

export function tierGraceEndDate(eventDate: Date, freeCutoff: string): Date {
  return new Date(tierCutoffDate(eventDate, freeCutoff).getTime() + GRACE_MINUTES * 60 * 1000);
}

export function tierWindowState(tier: TierPricingInput, eventDate: Date, now: Date = new Date()): TierWindowState {
  if (tier.price !== 0 || !tier.freeCutoff) return 'always';
  const cutoff = tierCutoffDate(eventDate, tier.freeCutoff);
  const graceEnd = tierGraceEndDate(eventDate, tier.freeCutoff);
  if (now.getTime() < cutoff.getTime()) return 'free';
  if (now.getTime() < graceEnd.getTime()) return 'grace';
  return 'closed';
}

/** The actual price to charge right now — never trust a client-supplied
 * price for this, always recompute server-side at quote/hold/create time. */
export function effectiveTierPrice(tier: TierPricingInput, eventDate: Date, now: Date = new Date()): number {
  return tierWindowState(tier, eventDate, now) === 'closed' ? (tier.lateFeePrice ?? tier.price) : tier.price;
}
