import type { TicketTier } from '../types';

/** Time-limited free entry — mirrors prebooze-api's
 * common/ticket-tier-pricing.ts exactly. Selling switches from free to
 * `lateFeePrice` the instant the cutoff passes — there's no grace period
 * on the *price*. The 15-minute grace (GRACE_MINUTES) is a gate/door
 * concept only, purely informational here: guests who already hold a free
 * ticket bought before the cutoff may still be let in up to 15 min late,
 * entirely at the organizer's discretion — it has no bearing on what a
 * *new* booking costs. This file is display-only: it decides what label/
 * price to *show*, never what to actually charge — the real amount always
 * comes from the server-authoritative quote() call, matching how the app
 * already never trusts a client-computed price for money. */

export const GRACE_MINUTES = 15;

export type TierWindowState = 'always' | 'free' | 'closed';

// Prebooze is India-only — "20:00" on a tier always means 8 PM IST, a
// fixed UTC+5:30 offset (India has no DST). Must NOT use Date's local
// setHours()/getHours(): this same code runs in every guest's browser,
// in whatever timezone their device happens to be set to (confirmed via
// a real cross-timezone test — a browser in a non-IST zone computed a
// cutoff hours away from what the IST-assuming server computed for the
// exact same "HH:MM"). Date.UTC()/getUTC* are timezone-independent, so
// the IST offset is applied explicitly and by hand instead.
const IST_OFFSET_MIN = 5.5 * 60;

/** Same "HH:MM on event night, next day if earlier than start" formula as
 * lib/promoterPass.ts's cutoffDate() — but IST-anchored (see
 * IST_OFFSET_MIN above) rather than local-time-based. */
export function tierCutoffDate(eventDate: string, freeCutoff: string): Date {
  const eventIstMs = new Date(eventDate).getTime() + IST_OFFSET_MIN * 60000;
  const eventIst = new Date(eventIstMs);
  const [h, m] = freeCutoff.split(':').map(Number);
  const cutoffIst = new Date(Date.UTC(eventIst.getUTCFullYear(), eventIst.getUTCMonth(), eventIst.getUTCDate(), h, m, 0, 0));
  if (cutoffIst.getTime() < eventIst.getTime()) cutoffIst.setUTCDate(cutoffIst.getUTCDate() + 1);
  return new Date(cutoffIst.getTime() - IST_OFFSET_MIN * 60000);
}

/** Purely informational (see file doc comment) — not used by pricing. */
export function tierGraceEndDate(eventDate: string, freeCutoff: string): Date {
  return new Date(tierCutoffDate(eventDate, freeCutoff).getTime() + GRACE_MINUTES * 60 * 1000);
}

export function tierWindowState(tier: TicketTier, eventDate: string): TierWindowState {
  if (tier.price !== 0 || !tier.freeCutoff) return 'always';
  return Date.now() < tierCutoffDate(eventDate, tier.freeCutoff).getTime() ? 'free' : 'closed';
}

/** Display price only — see file doc comment. */
export function displayTierPrice(tier: TicketTier, eventDate: string): number {
  return tierWindowState(tier, eventDate) === 'closed' ? (tier.lateFeePrice ?? tier.price) : tier.price;
}

/** The "from ₹X" cards/CTAs' min-price, using each tier's *current*
 * effective price — a free tier whose window has closed no longer pulls
 * the displayed minimum down to ₹0. */
export function displayMinPrice(tiers: TicketTier[], eventDate: string): number {
  return Math.min(...tiers.map((t) => displayTierPrice(t, eventDate)));
}

/** Whether the event has any currently-paid tier right now — drives the
 * "Free" vs "Free onwards" choice in formatFromPrice(). */
export function hasCurrentlyPaidTier(tiers: TicketTier[], eventDate: string): boolean {
  return tiers.some((t) => displayTierPrice(t, eventDate) > 0);
}

// Always shown in IST regardless of the guest's own device timezone — the
// cutoff was typed by the organizer as an IST wall-clock time, so a guest
// viewing from outside India should still see the same "8:00 PM" the
// organizer meant, not their own local equivalent.
function fmtHM(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true, timeZone: 'Asia/Kolkata' });
}

/** null when there's nothing worth saying (no freeCutoff, or the window's
 * already closed and it's just a normal paid tier at that point). */
export function tierWindowCaption(tier: TicketTier, eventDate: string): string | null {
  if (!tier.freeCutoff || tierWindowState(tier, eventDate) !== 'free') return null;
  const cutoff = fmtHM(tierCutoffDate(eventDate, tier.freeCutoff));
  return `Free until ${cutoff} — bookings after that are ₹${tier.lateFeePrice}. Already booked and running up to ${GRACE_MINUTES} min late? Entry then is at the organizer's discretion, not guaranteed by Prebooze.`;
}
