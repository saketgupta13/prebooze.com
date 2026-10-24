import type { TicketTier } from '../types';

/** Time-limited free entry — ports prebooze-web/src/lib/ticketTierPricing.ts
 * verbatim (pure logic, no React), which itself mirrors prebooze-api's
 * common/ticket-tier-pricing.ts exactly. Selling switches from free to
 * `lateFeePrice` the instant the cutoff passes — there's no grace period
 * on the *price*. This file is display-only: it decides what label/price to
 * *show*, never what to actually charge — the real amount always comes from
 * the server-authoritative quote() call. */

export const GRACE_MINUTES = 15;

export type TierWindowState = 'always' | 'free' | 'closed';

// Prebooze is India-only — "20:00" on a tier always means 8 PM IST, a
// fixed UTC+5:30 offset (India has no DST). Must NOT use Date's local
// setHours()/getHours() — this runs on a guest's device in whatever
// timezone it happens to be set to. Date.UTC()/getUTC* are timezone-
// independent, so the IST offset is applied explicitly by hand.
const IST_OFFSET_MIN = 5.5 * 60;

export function tierCutoffDate(eventDate: string, freeCutoff: string): Date {
  const eventIstMs = new Date(eventDate).getTime() + IST_OFFSET_MIN * 60000;
  const eventIst = new Date(eventIstMs);
  const [h, m] = freeCutoff.split(':').map(Number);
  const cutoffIst = new Date(Date.UTC(eventIst.getUTCFullYear(), eventIst.getUTCMonth(), eventIst.getUTCDate(), h, m, 0, 0));
  if (cutoffIst.getTime() < eventIst.getTime()) cutoffIst.setUTCDate(cutoffIst.getUTCDate() + 1);
  return new Date(cutoffIst.getTime() - IST_OFFSET_MIN * 60000);
}

export function tierGraceEndDate(eventDate: string, freeCutoff: string): Date {
  return new Date(tierCutoffDate(eventDate, freeCutoff).getTime() + GRACE_MINUTES * 60 * 1000);
}

export function tierWindowState(tier: TicketTier, eventDate: string): TierWindowState {
  if (tier.price !== 0 || !tier.freeCutoff) return 'always';
  return Date.now() < tierCutoffDate(eventDate, tier.freeCutoff).getTime() ? 'free' : 'closed';
}

export function displayTierPrice(tier: TicketTier, eventDate: string): number {
  return tierWindowState(tier, eventDate) === 'closed' ? (tier.lateFeePrice ?? tier.price) : tier.price;
}

export function displayMinPrice(tiers: TicketTier[], eventDate: string): number {
  return Math.min(...tiers.map((t) => displayTierPrice(t, eventDate)));
}

export function hasCurrentlyPaidTier(tiers: TicketTier[], eventDate: string): boolean {
  return tiers.some((t) => displayTierPrice(t, eventDate) > 0);
}

// Always shown in IST regardless of the guest's own device timezone.
function fmtHM(d: Date): string {
  return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: 'numeric', hour12: true, timeZone: 'Asia/Kolkata' });
}

export function formatCountdownDHM(targetMs: number, nowMs: number = Date.now()): string {
  const ms = Math.max(0, targetMs - nowMs);
  const totalMinutes = Math.floor(ms / 60000);
  const d = Math.floor(totalMinutes / 1440);
  const h = Math.floor((totalMinutes % 1440) / 60);
  const m = totalMinutes % 60;
  return `${d}d ${h}h ${m}m`;
}

export function tierCountdownLabel(tier: TicketTier, eventDate: string): string | null {
  if (!tier.freeCutoff || tierWindowState(tier, eventDate) !== 'free') return null;
  return formatCountdownDHM(tierCutoffDate(eventDate, tier.freeCutoff).getTime());
}

export function tierWindowCaption(tier: TicketTier, eventDate: string): string | null {
  if (!tier.freeCutoff || tierWindowState(tier, eventDate) !== 'free') return null;
  const cutoff = fmtHM(tierCutoffDate(eventDate, tier.freeCutoff));
  return `Free until ${cutoff} — bookings after that are ₹${tier.lateFeePrice}. Already booked and running up to ${GRACE_MINUTES} min late? Entry then is at the organizer's discretion, not guaranteed by Prebooze.`;
}
