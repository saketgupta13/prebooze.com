import type { Event, Venue } from '../types';

/** Download an .ics calendar file for an event (works with Google/Apple/Outlook). */
export function downloadIcs(event: Event, venue: Venue | undefined) {
  const start = new Date(event.date);
  const end = new Date(start.getTime() + (event.durationHrs || 3) * 3600000);
  const fmt = (d: Date) => d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Prebooze//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@prebooze.com`,
    `DTSTAMP:${fmt(new Date())}`,
    `DTSTART:${fmt(start)}`,
    `DTEND:${fmt(end)}`,
    `SUMMARY:${event.title.replace(/,/g, '\\,')}`,
    `LOCATION:${venue ? `${venue.name}\\, ${venue.city}`.replace(/,/g, '\\,') : 'TBA'}`,
    `DESCRIPTION:Your Prebooze ticket QR is in My Bookings. ${(`${window.location.origin}/events/${event.slug}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  // Blob + object URL, not a raw data: URI — see the identical note in
  // lib/ticket.ts; same cross-browser download reliability fix.
  const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${event.slug}.ics`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
