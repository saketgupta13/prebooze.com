import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Event } from '../types';

const KEY = 'pb_recently_viewed';
const MAX = 10;

/** Local "recently viewed events" trail — Home's own slider and the sticky
 * bottom "continue where you left off" bar both read from this, same
 * AsyncStorage-cache pattern as bookingsCache.ts (not sensitive, can hold
 * several full event objects). Most-recent-first, deduped by id so
 * re-viewing an event moves it back to the front instead of listing it
 * twice. Best-effort both ways — a failed read/write just means this
 * screen's recall of recent events, not the actual browsing it reflects. */
export async function recordEventView(event: Event): Promise<void> {
  try {
    const list = await getRecentlyViewed();
    const next = [event, ...list.filter((e) => e.id !== event.id)].slice(0, MAX);
    await AsyncStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // best-effort
  }
}

export async function getRecentlyViewed(): Promise<Event[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Event[]) : [];
  } catch {
    return [];
  }
}
