import type { Booking, Event, Person } from '../types';
import { ATTENDANCE, personById } from '../data/mock';

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

export interface FriendGoing {
  person: Person;
  status: 'going' | 'interested';
}

/** People the user follows who are attending this event (seeded people are public). */
export function friendsGoing(eventId: string, following: string[]): FriendGoing[] {
  const followed = new Set(followedPersonIds(following));
  return ATTENDANCE.filter((a) => a.eventId === eventId && followed.has(a.personId))
    .map((a) => ({ person: personById(a.personId), status: a.status }))
    .filter((x): x is FriendGoing => !!x.person)
    // going before interested
    .sort((a, b) => (a.status === b.status ? 0 : a.status === 'going' ? -1 : 1));
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
