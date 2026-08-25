/** A ₹0 ticket tier is a real, deliberate free-entry tier (e.g. a
 * gender-based free tier alongside a paid one) — displaying "₹0" reads as
 * broken pricing rather than an intentional free ticket. */
export function formatPrice(n: number): string {
  return n === 0 ? 'Free' : `₹${n}`;
}
