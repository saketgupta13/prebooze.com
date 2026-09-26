/** Translates an OrgNotification's `to` field (a backend-authored deep-link
 * hint like "/bookings/:id" or "/events/:id") into a real web route under
 * /organizer. Mirrors prebooze-organizer's notificationNav.ts regex logic —
 * same three id-bearing patterns, same bare-path fallbacks — but composes a
 * literal path for react-router instead of RN's nav(screen, params) calls. */
export function notificationWebPath(to?: string | null): string | null {
  if (!to) return null;

  const bookingMatch = to.match(/^\/bookings\/([^/?]+)/);
  if (bookingMatch) return `/organizer/bookings/${decodeURIComponent(bookingMatch[1])}`;

  // No dedicated cart detail page exists — same call RN made: open the list
  // and let it scroll to/highlight the row via a query param.
  const cartMatch = to.match(/^\/abandoned-carts\/([^/?]+)/);
  if (cartMatch) return `/organizer/carts?cartId=${encodeURIComponent(decodeURIComponent(cartMatch[1]))}`;

  const eventMatch = to.match(/^\/events\/([^/?]+)/);
  if (eventMatch) return `/organizer/events/${decodeURIComponent(eventMatch[1])}/edit`;

  switch (to) {
    case '/events': return '/organizer/events';
    case '/bookings': return '/organizer/bookings';
    case '/payouts': return '/organizer/payouts';
    case '/transactions': return '/organizer/transactions';
    case '/abandoned-carts': return '/organizer/carts';
    case '/reviews': return '/organizer/reviews';
    case '/team-roles': return '/organizer/team';
    default: return null; // unrecognized — stay put rather than dead-navigate
  }
}
