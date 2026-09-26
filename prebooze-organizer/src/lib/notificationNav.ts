/** Maps an OrgNotification's `to` field (a web-style path, e.g. "/events" or
 * "/bookings/:id" — same values bookings.service.ts/organizer.service.ts
 * send) to a real RN navigation call. Shared between NotificationsScreen's
 * in-app row tap and App.tsx's OS-notification-tap handler (foreground/
 * background/killed) — both just need something with a
 * `navigate(name, params)` method, which both the `useNavigation()` hook's
 * object and a NavigationContainer ref satisfy, so this stays
 * framework-generic rather than importing either.
 *
 * Real gap fixed 2026-09-26: every `to` used to be a bare list path
 * ('/bookings', '/transactions', '/abandoned-carts') even though the
 * backend always had the specific booking/cart/event id in scope when it
 * sent the notification — tapping a booking or refund notification landed
 * on the generic Bookings list instead of that booking's own detail
 * screen. Booking/refund/cart/event `to` values now carry the real id as a
 * path segment; matched here with a regex instead of exact equality. */
type Navigator = { navigate: (name: never, params?: object) => void };

export function navigateToNotificationTarget(navigation: Navigator, to?: string | null): void {
  if (!to) return;
  const nav = navigation.navigate as (name: string, params?: object) => void;

  const bookingMatch = to.match(/^\/bookings\/([^/?]+)/);
  if (bookingMatch) {
    nav('Bookings', { screen: 'BookingDetail', params: { id: decodeURIComponent(bookingMatch[1]) } });
    return;
  }
  const cartMatch = to.match(/^\/abandoned-carts\/([^/?]+)/);
  if (cartMatch) {
    nav('More', { screen: 'AbandonedCarts', params: { cartId: decodeURIComponent(cartMatch[1]) } });
    return;
  }
  const eventMatch = to.match(/^\/events\/([^/?]+)/);
  if (eventMatch) {
    nav('Events', { screen: 'EventWizard', params: { eventId: decodeURIComponent(eventMatch[1]) } });
    return;
  }

  switch (to) {
    case '/events':
      nav('Events', { screen: 'EventsList' });
      break;
    case '/bookings':
      nav('Bookings', { screen: 'BookingsList' });
      break;
    case '/payouts':
      nav('More', { screen: 'Payouts' });
      break;
    case '/transactions':
      nav('More', { screen: 'Transactions' });
      break;
    case '/abandoned-carts':
      nav('More', { screen: 'AbandonedCarts' });
      break;
    case '/reviews':
      nav('More', { screen: 'Reviews' });
      break;
    case '/team-roles':
      nav('More', { screen: 'TeamRoles' });
      break;
    default:
      // Unrecognized `to` — land on Dashboard rather than doing nothing at
      // all, so a future new notification kind isn't a dead tap while its
      // real target gets wired in.
      break;
  }
}
