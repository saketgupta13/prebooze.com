import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Booking } from '../types';

/** Android's practical stand-in for an iOS Live Activity — this app is
 * Android-only until Xcode 27 GM ships (see the organizer app's own build
 * history), so an actual Live Activity isn't buildable or testable right
 * now. A `sticky` (non-swipe-dismissible) local notification, scheduled for
 * the morning of the event and deep-linking straight to the QR ticket, gets
 * most of the real value — quick, can't-lose-it access to the ticket on the
 * day it matters — without native module work. Revisit with a real Live
 * Activity once iOS is unblocked.
 *
 * Scheduled ids are kept in AsyncStorage (not SecureStore — same
 * reasoning as bookingsCache.ts, nothing sensitive here) keyed by booking
 * id, so a cancelled/refunded booking's notification can be torn down
 * again by id rather than leaving a stale "tonight's the night" ping for a
 * ticket that no longer exists. */
const KEY = 'pb_eventday_notif_ids';

async function readMap(): Promise<Record<string, string>> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, string>) : {};
  } catch {
    return {};
  }
}

async function writeMap(map: Record<string, string>): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(map));
  } catch {
    // best-effort
  }
}

/** 10am local time on the event's own day — early enough to be useful
 * before an evening event, never in the past (skipped entirely if the
 * event's day has already started past 10am, since the point is a
 * same-day reminder, not a stale one firing retroactively). */
function tenAmOnEventDay(eventDateIso: string): Date | null {
  const eventDate = new Date(eventDateIso);
  const fire = new Date(eventDate);
  fire.setHours(10, 0, 0, 0);
  if (fire.getTime() <= Date.now()) return null;
  return fire;
}

export async function scheduleEventDayNotification(booking: Booking): Promise<void> {
  if (Platform.OS !== 'android') return; // sticky is Android-only; see doc comment above
  if (booking.status !== 'confirmed' || !booking.event) return;
  const fireAt = tenAmOnEventDay(booking.event.date);
  if (!fireAt) return;
  try {
    const map = await readMap();
    if (map[booking.id]) return; // already scheduled, never double up
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: `Tonight: ${booking.event.title}`,
        body: 'Tap for your QR ticket — no signal needed at the door.',
        sticky: true,
        data: { eventSlug: booking.event.slug, bookingId: booking.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: fireAt },
    });
    map[booking.id] = id;
    await writeMap(map);
  } catch {
    // best-effort — missing this reminder is never worse than the booking
    // itself, which still works fully without it.
  }
}

export async function cancelEventDayNotification(bookingId: string): Promise<void> {
  try {
    const map = await readMap();
    const id = map[bookingId];
    if (!id) return;
    await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
    delete map[bookingId];
    await writeMap(map);
  } catch {
    // best-effort
  }
}
