import type { TicketTier } from '../types';

/** Faithful port of prebooze-web/src/lib/ticketTierPricing.ts. Time-limited
 * free entry — mirrors prebooze-api's common/ticket-tier-pricing.ts
 * exactly. Selling switches from free to `lateFeePrice` the instant the
 * cutoff passes — there's no grace period on the *price*. This file is
 * display-only: it decides what label/price to *show*, never what to
 * actually charge — the real amount always comes from the server-
 * authoritative quote() call. */

export type TierWindowState = 'always' | 'free' | 'closed';

// Prebooze is India-only — "20:00" on a tier always means 8 PM IST, a
// fixed UTC+5:30 offset (India has no DST). Must NOT use Date's local
// setHours()/getHours() — see the web original's doc comment for the real
// cross-timezone bug this avoids.
const IST_OFFSET_MIN = 5.5 * 60;

export function tierCutoffDate(eventDate: string, freeCutoff: string): Date {
  const eventIstMs = new Date(eventDate).getTime() + IST_OFFSET_MIN * 60000;
  const eventIst = new Date(eventIstMs);
  const [h, m] = freeCutoff.split(':').map(Number);
  const cutoffIst = new Date(Date.UTC(eventIst.getUTCFullYear(), eventIst.getUTCMonth(), eventIst.getUTCDate(), h, m, 0, 0));
  if (cutoffIst.getTime() < eventIst.getTime()) cutoffIst.setUTCDate(cutoffIst.getUTCDate() + 1);
  return new Date(cutoffIst.getTime() - IST_OFFSET_MIN * 60000);
}

export function tierWindowState(tier: TicketTier, eventDate: string): TierWindowState {
  if (tier.price !== 0 || !tier.freeCutoff) return 'always';
  return Date.now() < tierCutoffDate(eventDate, tier.freeCutoff).getTime() ? 'free' : 'closed';
}

/** Display price only — see file doc comment. */
export function displayTierPrice(tier: TicketTier, eventDate: string): number {
  return tierWindowState(tier, eventDate) === 'closed' ? (tier.lateFeePrice ?? tier.price) : tier.price;
}
