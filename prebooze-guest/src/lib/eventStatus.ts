import type { Event } from '../types';

// Same formula as prebooze-api's CatalogService.isEventOver — an event
// isn't "over" the instant it starts, only once it's actually finished
// (date + durationHrs, or seriesEndDate for a multi-day event/workshop).
export function isEventOver(e: { date: string; durationHrs: number; seriesEndDate?: string | null }): boolean {
  if (e.seriesEndDate) return new Date(e.seriesEndDate).getTime() + 24 * 3600000 < Date.now();
  return new Date(e.date).getTime() + e.durationHrs * 3600000 < Date.now();
}

/** Same "sold out" definition as prebooze-web's EventCard.tsx — a past
 * event can't be booked regardless of inventory left, otherwise it's sold
 * out only once every tier is fully sold. */
export function isSoldOut(ev: Event, isPast: boolean): boolean {
  return isPast || ev.tiers.every((t) => t.sold >= t.quantity);
}
