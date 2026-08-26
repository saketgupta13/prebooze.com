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
