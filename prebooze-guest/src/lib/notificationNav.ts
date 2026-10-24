import type { NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { social } from '../api/social';
import type { RootStackParamList } from '../navigation/types';

/** Deep-links a tapped push notification straight to its event, instead of
 * just opening to Home — the whole point of the follow → push → book loop
 * (see the plan's "follower-notify-on-new-event" backend work) is that a
 * tap lands exactly where the push promised. Expects `data.eventSlug` on
 * the push payload; anything else (or no data) is a no-op, same defensive
 * pattern as prebooze-organizer's identical handler.
 *
 * Also marks the matching in-app inbox row read when `data.notificationId`
 * is present — real bug: tapping the OS tray notification used to deep-link
 * fine but leave the row sitting unread in the Notifications feed, since
 * the only place that ever called markRead was tapping a row inside the
 * feed itself. Fire-and-forget, never blocks the navigation.
 *
 * `data.bookingId`, when present, takes priority over `eventSlug` — only
 * the local event-day reminder (eventDayNotification.ts) sets it, and the
 * whole point of that notification is "works with no signal at the door",
 * which EventDetail's network fetch would defeat. BookingDetail already has
 * an offline cached-bookings fallback (bookingsCache.ts) that actually
 * delivers on that. */
export function navigateToNotificationTarget(
  ref: NavigationContainerRefWithCurrent<RootStackParamList>,
  data: unknown,
): void {
  if (!data || typeof data !== 'object') return;
  const notificationId = (data as Record<string, unknown>).notificationId;
  if (typeof notificationId === 'string' && notificationId) {
    social.markNotificationRead(notificationId).catch(() => {});
  }
  const bookingId = (data as Record<string, unknown>).bookingId;
  if (typeof bookingId === 'string' && bookingId) {
    ref.navigate('BookingDetail', { bookingId });
    return;
  }
  const eventSlug = (data as Record<string, unknown>).eventSlug;
  if (typeof eventSlug === 'string' && eventSlug) {
    ref.navigate('EventDetail', { slug: eventSlug });
  }
}
