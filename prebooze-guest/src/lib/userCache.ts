/** Local cache of the signed-in guest's own profile — lets boot fall back
 * to "logged in, offline" instead of "logged out" when a plain network
 * failure (not a real invalid/expired session) is what auth.me() hit.
 * Same AsyncStorage reasoning as bookingsCache.ts. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { User } from '../types';

const KEY = 'pb_user_cache';

export async function cacheUser(user: User): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(user));
  } catch {
    // best-effort
  }
}

export async function getCachedUser(): Promise<User | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as User) : null;
  } catch {
    return null;
  }
}

export async function clearCachedUser(): Promise<void> {
  try {
    await AsyncStorage.removeItem(KEY);
  } catch {
    // ignore
  }
}
