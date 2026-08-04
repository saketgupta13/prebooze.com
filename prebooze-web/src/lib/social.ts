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
