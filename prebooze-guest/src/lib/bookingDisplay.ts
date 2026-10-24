import { eventPath, absoluteUrl } from './urls';
import type { Booking } from '../types';

/** Shared formatting/helpers between BookingConfirmedScreen and the My
 * Bookings detail screen — both show the same booking+event fields, kept
 * in one place so the two can't drift out of sync. */

export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
export const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
export const formatPrice = (n: number) => (n === 0 ? 'Free' : `₹${n}`);

export const eventLocation = (event: NonNullable<Booking['event']>): string => {
  if (event.venue) return `${event.venue.name}, ${event.venue.city}`;
  if (event.unlistedVenueName && event.unlistedVenueCity) return `${event.unlistedVenueName}, ${event.unlistedVenueCity}`;
  if (event.privateLocality && event.privateCity) return `${event.privateLocality}, ${event.privateCity}`;
  return 'Location TBA';
};

/** Real .ics text, same fields web's lib/calendar.ts writes — works with
 * Google/Apple/Outlook once shared through the OS share sheet. */
export function buildIcs(event: NonNullable<Booking['event']>): string {
  const start = new Date(event.date);
  const end = new Date(start.getTime() + (event.durationHrs || 3) * 3600000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const loc = eventLocation(event).replace(/,/g, '\\,');
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Prebooze//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@prebooze.com`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${event.title.replace(/,/g, '\\,')}`,
    `LOCATION:${loc}`,
    `DESCRIPTION:Your Prebooze ticket QR is in My Bookings. ${absoluteUrl(eventPath(event.venue?.city ?? event.unlistedVenueCity ?? event.privateCity ?? '', event.slug))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
}
