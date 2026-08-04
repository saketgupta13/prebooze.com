import type { Event, Venue } from '../types';

/** Real venue name+city when set, or the organizer's own free-text
 * locality+city for a private-address event, or a neutral fallback —
 * every guest-facing spot that used to assume `venue` always exists on an
 * Event goes through this instead of reading venue.name/city directly. */
export function eventLocation(event: Event, venue?: Venue): string {
  if (venue) return `${venue.name}, ${venue.city}`;
  if (event.privateLocality && event.privateCity) return `${event.privateLocality}, ${event.privateCity}`;
  return 'Location TBA';
}
