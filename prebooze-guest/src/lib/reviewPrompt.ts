import * as StoreReview from 'expo-store-review';
import AsyncStorage from '@react-native-async-storage/async-storage';

const BOOKING_COUNT_KEY = 'pb_confirmed_booking_count';
const ASKED_KEY = 'pb_review_asked';

/** Prompts for an App Store/Play Store rating after a guest's 2nd
 * successful booking — the 1st could be a one-off/lucky first impression,
 * the 2nd is a real signal they're actually using the app. Both stores
 * already internally throttle how often the native prompt can show at all
 * (Apple: max 3 times per 365 days; Android similarly rate-limited), so
 * this doesn't need its own cooldown logic beyond "ask once, ever" — a
 * local flag stops this code from even trying again after that first ask,
 * rather than relying solely on the OS-side throttle. Native is a no-op
 * silently (StoreReview.isAvailableAsync()) on anything that isn't a real
 * device build capable of showing it (e.g. Expo Go, most emulators). */
export async function maybeRequestReview(): Promise<void> {
  try {
    const asked = await AsyncStorage.getItem(ASKED_KEY);
    if (asked) return;

    const raw = await AsyncStorage.getItem(BOOKING_COUNT_KEY);
    const count = (raw ? parseInt(raw, 10) : 0) + 1;
    await AsyncStorage.setItem(BOOKING_COUNT_KEY, String(count));
    if (count < 2) return;

    if (!(await StoreReview.isAvailableAsync())) return;
    await AsyncStorage.setItem(ASKED_KEY, '1');
    await StoreReview.requestReview();
  } catch {
    // best-effort — a rating prompt failing is never worse than the real
    // booking confirmation it's layered on top of
  }
}
