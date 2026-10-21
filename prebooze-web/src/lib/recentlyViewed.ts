/** Locally-tracked "recently viewed events" — mirrors prebooze-guest's (RN
 * app) recently-viewed feature, localStorage standing in for AsyncStorage.
 * Last 10, most-recent-first, deduped by id. A lightweight snapshot (not
 * just an id) so Home can render a thumbnail strip without needing to
 * refetch or cross-reference whatever city's event list happens to be
 * loaded — a guest can view an event in one city, then land on Home set to
 * another. */

export interface RecentlyViewedEvent {
  id: string;
  slug: string;
  title: string;
  posterUrl?: string | null;
  posterHue: number;
  date: string; // ISO
  city: string;
}

const KEY = 'pb_recently_viewed';
const MAX = 10;

export function getRecentlyViewed(): RecentlyViewedEvent[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function recordEventView(event: RecentlyViewedEvent) {
  try {
    const existing = getRecentlyViewed().filter((e) => e.id !== event.id);
    const next = [event, ...existing].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // localStorage unavailable (private mode, quota, etc.) — recently
    // viewed is a nice-to-have, never worth surfacing an error for.
  }
}
