import type { Event } from '../types';

/** Free-entry cutoff as an absolute datetime. "Free before HH:MM" on the event's
 * night — if the cutoff clock time is earlier than the event start, it's the next
 * calendar day (e.g. an 8 PM gig with "free before 1 AM" = 1 AM the following morning). */
export function cutoffDate(event: Event): Date | null {
  const cfg = event.promoterConfig;
  if (!cfg?.enabled || !cfg.cutoff) return null;
  const start = new Date(event.date);
  const [h, m] = cfg.cutoff.split(':').map(Number);
  const c = new Date(start);
  c.setHours(h, m, 0, 0);
  if (c.getTime() < start.getTime()) c.setDate(c.getDate() + 1);
  return c;
}

export function isPassValid(event: Event): boolean {
  const c = cutoffDate(event);
  return c ? Date.now() < c.getTime() : false;
}

export function countdownLabel(target: Date): string {
  const ms = target.getTime() - Date.now();
  if (ms <= 0) return 'closed';
  const mins = Math.floor(ms / 60000);
  const d = Math.floor(mins / 1440);
  const h = Math.floor((mins % 1440) / 60);
  const mm = mins % 60;
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${mm}m`;
  return `${mm}m`;
}
