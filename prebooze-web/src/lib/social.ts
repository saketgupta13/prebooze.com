import type { Booking, Event } from '../types';

export const PERSON_PREFIX = 'person:';
export const personFollowKey = (id: string) => PERSON_PREFIX + id;

/** Ids of people the user follows, from the shared follow list. */
export function followedPersonIds(following: string[]): string[] {
  return following.filter((f) => f.startsWith(PERSON_PREFIX)).map((f) => f.slice(PERSON_PREFIX.length));
}

/** The crowd number shown as "N going" — derived from confirmed ticket sales. */
export function goingCount(event: Event): number {
  return event.tiers.reduce((a, t) => a + t.sold, 0);
}

/** Hide the "N going" social-proof number for events that haven't earned
 * it yet — a low count reads as "nobody wants this" and discourages
 * booking, so it only shows once sales hit half of total capacity. */
export function showGoing(event: Event): boolean {
  const cap = event.tiers.reduce((a, t) => a + t.quantity, 0);
  return cap > 0 && goingCount(event) / cap >= 0.5;
}

/** The current user's own relationship to an event. */
export function myStatus(
  eventId: string,
  bookings: Booking[],
  interested: string[]
): 'going' | 'interested' | null {
  if (bookings.some((b) => b.eventId === eventId && b.status !== 'cancelled')) return 'going';
  if (interested.includes(eventId)) return 'interested';
  return null;
}

// Admin types this as either a bare "instagram.com/prebooze_com"-style
// handle or a full URL (same real, admin-configurable field Footer.tsx
// already reads via socials.instagram) — this pulls out just the trailing
// @handle for a short mention, not a clickable link.
export function instagramHandle(url?: string): string | null {
  if (!url?.trim()) return null;
  const parts = url.trim().replace(/\/+$/, '').split('/');
  return parts[parts.length - 1] || null;
}

/** Real bug (2026-11-27): an organizer/venue typing their real Instagram
 * link into the Instagram field almost always just types their bare
 * @username (what they'd actually hand someone), not a full URL or even
 * "instagram.com/…" — every caller that only special-cased "already has
 * http" (`l.startsWith('http') ? l : https://${l}`) then built
 * `https://<username>` instead of `https://instagram.com/<username>`, a
 * domain that doesn't exist, so the link never actually opened their
 * profile. Handles all three real shapes typed in practice: a bare
 * username (with or without a leading @), "instagram.com/username", and a
 * full https:// URL. */
export function instagramUrl(input?: string): string {
  if (!input?.trim()) return '';
  const v = input.trim().replace(/^@/, '');
  if (/^https?:\/\//i.test(v)) return v;
  if (/^(www\.)?instagram\.com\//i.test(v)) return `https://${v}`;
  return `https://instagram.com/${v.replace(/^\/+/, '')}`;
}
