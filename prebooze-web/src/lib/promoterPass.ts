import type { Event } from '../types';

// Prebooze is India-only — "01:00" on a promoter config always means 1 AM
// IST, a fixed UTC+5:30 offset (India has no DST). Must NOT use Date's
// local setHours()/getHours(): this same code runs in every guest's
// browser, in whatever timezone their device happens to be set to —
// confirmed via a real cross-timezone test (same bug, same fix, in the
// sibling ticket-tier free-entry feature — see lib/ticketTierPricing.ts)
// that a browser outside IST computes a cutoff hours away from what an
// IST-assuming interpretation intends. Date.UTC()/getUTC* are timezone-
// independent, so the IST offset is applied explicitly and by hand instead.
const IST_OFFSET_MIN = 5.5 * 60;

/** Free-entry cutoff as an absolute datetime. "Free before HH:MM" on the event's
 * night — if the cutoff clock time is earlier than the event start, it's the next
 * calendar day (e.g. an 8 PM gig with "free before 1 AM" = 1 AM the following morning).
 * IST-anchored (see IST_OFFSET_MIN above) rather than local-time-based. */
export function cutoffDate(event: Event): Date | null {
  const cfg = event.promoterConfig;
  if (!cfg?.enabled || !cfg.cutoff) return null;
  const startIstMs = new Date(event.date).getTime() + IST_OFFSET_MIN * 60000;
  const startIst = new Date(startIstMs);
  const [h, m] = cfg.cutoff.split(':').map(Number);
  const cIst = new Date(Date.UTC(startIst.getUTCFullYear(), startIst.getUTCMonth(), startIst.getUTCDate(), h, m, 0, 0));
  if (cIst.getTime() < startIst.getTime()) cIst.setUTCDate(cIst.getUTCDate() + 1);
  return new Date(cIst.getTime() - IST_OFFSET_MIN * 60000);
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
