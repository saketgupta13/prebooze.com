/** Infers how many people one unit of a ticket tier admits, straight from
 * its own name — "Couple" = 2, "Group of 5" = 5, anything else = 1. No
 * separate field to keep in sync: the organizer's own tier name is already
 * what a guest reads before buying, so it's the single source of truth. */
export function partySizeFromTierName(name: string): number {
  const n = name.toLowerCase();
  if (/\bcouple\b/.test(n)) return 2;
  const m =
    n.match(/\b(?:group|squad|table|gang|crew|barkada)\s+of\s+(\d+)\b/) ||
    n.match(/\b(\d+)\s*(?:pax|people|persons|ppl)\b/);
  if (m) return Math.max(1, parseInt(m[1], 10));
  return 1;
}

/** Specifically a "Couple" tier (not just any 2-person tier like "Group of
 * 2") — the one case where door policy at most Indian nightlife venues
 * requires exactly one male + one female, to keep an all-male "stag" group
 * from entering at the discounted Couple rate. */
export function isCoupleTierName(name: string): boolean {
  return /\bcouple\b/.test(name.toLowerCase());
}
