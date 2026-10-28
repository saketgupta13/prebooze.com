import type { Featured } from '../types';

/** Ref-ids of items with an active, in-window featured placement for a city + type. */
export function featuredRefs(featured: Featured[], type: Featured['type'], city: string): Set<string> {
  const now = Date.now();
  return new Set(
    featured
      .filter((f) => f.type === type && f.status === 'active' && f.city === city && new Date(f.expiresAt).getTime() > now)
      .map((f) => f.refId)
  );
}

/** True if this ref is featured anywhere (any city) — for badging cards outside a city context. */
export function isFeatured(featured: Featured[], type: Featured['type'], refId: string): boolean {
  const now = Date.now();
  return featured.some((f) => f.type === type && f.refId === refId && f.status === 'active' && new Date(f.expiresAt).getTime() > now);
}

/** The current pending/active featured record for an item, if any. */
export function findFeatured(featured: Featured[], type: Featured['type'], refId: string): Featured | undefined {
  const now = Date.now();
  return featured.find(
    (f) => f.type === type && f.refId === refId && (f.status === 'pending' || (f.status === 'active' && new Date(f.expiresAt).getTime() > now))
  );
}

/** Stable sort putting featured refs first, keeping the organic order within each group. */
export function featuredFirst<T>(items: T[], refOf: (t: T) => string, refs: Set<string>): T[] {
  return [...items].sort((a, b) => (refs.has(refOf(b)) ? 1 : 0) - (refs.has(refOf(a)) ? 1 : 0));
}

/** Fisher-Yates shuffle — a new copy, original array untouched. Used so the
 * Top organizers/promoters/lineups/venues home sections don't always show
 * the exact same highest-rating/most-followed profiles in the exact same
 * order on every single visit (a real fairness complaint: an org with 4.9
 * rating and 50 followers would otherwise permanently bury a newer org with
 * 4.6 and 40 followers). featuredFirst() is still applied on top of this,
 * so a paid Featured placement always wins regardless of the shuffle. */
export function shuffle<T>(items: T[]): T[] {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
