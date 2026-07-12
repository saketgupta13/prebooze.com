import type { Event } from '../types';
import type { PromoterGuest } from '../store/AppContext';
import { cutoffDate } from './promoterPass';

/** A phone with this many past no-shows is blocked from joining new free lists. */
export const NO_SHOW_BLOCK_THRESHOLD = 3;

const norm = (p: string) => (p || '').replace(/\D/g, '').slice(-10);

/** One free pass per phone per event — returns an existing pass id for this phone, if any. */
export function existingPassId(guests: PromoterGuest[], eventId: string, phone: string): string | null {
  const g = guests.find((x) => x.eventId === eventId && norm(x.phone) === norm(phone));
  return g ? g.id : null;
}

/** Past events where this phone was on a list, the cutoff has passed, and they never arrived. */
export function noShowCount(guests: PromoterGuest[], phone: string, events: Event[]): number {
  const now = Date.now();
  return guests.filter((g) => {
    if (norm(g.phone) !== norm(phone) || g.arrived) return false;
    const ev = events.find((e) => e.id === g.eventId);
    const c = ev ? cutoffDate(ev) : null;
    return c ? now >= c.getTime() : false;
  }).length;
}

/** True when a phone has racked up enough no-shows to be blocked from new free lists. */
export function phoneBlocked(guests: PromoterGuest[], phone: string, events: Event[]): boolean {
  return noShowCount(guests, phone, events) >= NO_SHOW_BLOCK_THRESHOLD;
}

/** Live show-rate (%) for a promoter from decided guests (cutoff passed): arrived / decided.
 * Returns null when there's no settled history yet. */
export function liveShowRate(guests: PromoterGuest[], slug: string, events: Event[]): number | null {
  const now = Date.now();
  const decided = guests.filter((g) => {
    if (g.promoterSlug !== slug) return false;
    if (g.arrived) return true;
    const ev = events.find((e) => e.id === g.eventId);
    const c = ev ? cutoffDate(ev) : null;
    return c ? now >= c.getTime() : false;
  });
  if (decided.length === 0) return null;
  return Math.round((decided.filter((g) => g.arrived).length / decided.length) * 100);
}
