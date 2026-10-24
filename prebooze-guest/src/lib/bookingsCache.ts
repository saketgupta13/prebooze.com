/** Local cache of the guest's own bookings, so the QR ticket (the one
 * screen a guest actually needs at a crowded, bad-signal venue door) still
 * opens when bookingsApi.list() can't reach the network — a real gap, not
 * a mirroring one (web has no equivalent caching either; a native app can
 * do this in a way a browser tab reasonably can't). AsyncStorage, not
 * SecureStore — this list can hold many bookings with full nested event
 * objects, well past SecureStore/Keychain's ~2KB-per-item safe limit, and
 * none of it is more sensitive than what the same authenticated API
 * already serves on every normal load. Best-effort both ways: a failed
 * write/read just means no offline fallback this time, never a crash. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Booking } from '../types';

const KEY = 'pb_bookings_cache';

export async function cacheBookings(bookings: Booking[]): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(bookings));
  } catch {
    // best-effort
  }
}

export async function getCachedBookings(): Promise<Booking[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Booking[]) : [];
  } catch {
    return [];
  }
}
