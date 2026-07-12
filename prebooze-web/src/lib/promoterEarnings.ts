import type { Booking, Event } from '../types';
import type { PromoterGuest } from '../store/AppContext';
import { SUB_TIERS } from '../data/mock';

/** Affiliate commission a promoter earns on a paid ticket sale made through their
 * link (share of ticket subtotal, before fees). Configurable server-side later. */
export const PROMOTER_COMMISSION_RATE = 0.08;
export const COMMISSION_LABEL = '8%';

/** Monthly guest quota for a plan id. -1 = unlimited. */
export function planQuota(planId?: string): number {
  const t = SUB_TIERS.find((x) => x.id === (planId ?? 'free')) ?? SUB_TIERS[0];
  return t.guests;
}

const sameMonth = (iso: string, ref: Date) => {
  const d = new Date(iso);
  return d.getFullYear() === ref.getFullYear() && d.getMonth() === ref.getMonth();
};

/** How many guests a promoter has added to lists in the given month (default: now). */
export function guestsThisMonth(guests: PromoterGuest[], slug: string, ref: Date = new Date()): number {
  return guests.filter((g) => g.promoterSlug === slug && sameMonth(g.createdAt, ref)).length;
}

/** True when the promoter has hit or exceeded their monthly quota. */
export function quotaReached(guests: PromoterGuest[], slug: string, planId?: string, ref: Date = new Date()): boolean {
  const q = planQuota(planId);
  if (q < 0) return false;
  return guestsThisMonth(guests, slug, ref) >= q;
}

/** ₹ earned from per-head payouts — verified (arrived) guests × the event's per-head amount. */
export function perHeadEarnings(events: Event[], guests: PromoterGuest[], slug: string): number {
  return events.reduce((sum, e) => {
    const cfg = e.promoterConfig;
    if (!cfg?.enabled || !cfg.perHeadPayout) return sum;
    const arrived = guests.filter((g) => g.eventId === e.id && g.promoterSlug === slug && g.arrived).length;
    return sum + arrived * cfg.perHeadAmount;
  }, 0);
}

export interface CommissionResult {
  amount: number;
  sales: number;
  tickets: number;
}

/** ₹ earned as affiliate commission from paid bookings attributed to this promoter. */
export function commissionEarnings(bookings: Booking[], slug: string): CommissionResult {
  const mine = bookings.filter((b) => b.promoterRef === slug && b.status !== 'cancelled');
  return {
    amount: mine.reduce((a, b) => a + Math.round(b.subtotal * PROMOTER_COMMISSION_RATE), 0),
    sales: mine.length,
    tickets: mine.reduce((a, b) => a + b.qty, 0),
  };
}
