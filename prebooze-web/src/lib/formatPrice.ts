/** A ₹0 ticket tier is a real, deliberate free-entry tier (e.g. a
 * gender-based free tier alongside a paid one) — displaying "₹0" reads as
 * broken pricing rather than an intentional free ticket. */
export function formatPrice(n: number): string {
  return n === 0 ? 'Free' : `₹${n}`;
}

/** For a "from ₹X" style min-price display (browse cards, the ticket-box
 * CTA) — when the cheapest tier is free, "Free onwards" signals a paid
 * tier also exists (e.g. PM Rituals: free for some, ₹499 for others), so
 * it doesn't read as "the whole event is free" when it isn't. Only when
 * every tier is genuinely free does plain "Free" apply. */
export function formatFromPrice(minPrice: number, hasPaidTier: boolean): string {
  if (minPrice > 0) return `from ₹${minPrice}`;
  return hasPaidTier ? 'Free onwards' : 'Free';
}
