/** Maps an OrgNotification's `to` field (a web-style path, e.g. "/events" —
 * same values organizer.service.ts / seedDemo already send) to a real RN
 * navigation call. Shared between NotificationsScreen's in-app row tap and
 * App.tsx's OS-notification-tap handler (foreground/background/killed) —
 * both just need something with a `navigate(name, params)` method, which
 * both the `useNavigation()` hook's object and a NavigationContainer ref
 * satisfy, so this stays framework-generic rather than importing either. */
type Navigator = { navigate: (name: never, params?: object) => void };

export function navigateToNotificationTarget(navigation: Navigator, to?: string | null): void {
  if (!to) return;
  const nav = navigation.navigate as (name: string, params?: object) => void;
  switch (to) {
    case '/events':
      nav('Events', { screen: 'EventsList' });
      break;
    case '/bookings':
      nav('Bookings');
      break;
    case '/payouts':
      nav('More', { screen: 'Payouts' });
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
