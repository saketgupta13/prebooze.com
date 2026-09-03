import type { VenueDayKey, VenueTimingsByDay } from '../types';

const DAY_ORDER: VenueDayKey[] = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const DAY_LABELS: Record<VenueDayKey, string> = { mon: 'Mon', tue: 'Tue', wed: 'Wed', thu: 'Thu', fri: 'Fri', sat: 'Sat', sun: 'Sun' };
// Date.getDay(): 0=Sun..6=Sat — reorder to match our Mon-first VenueDayKey.
const JS_DAY_TO_KEY: VenueDayKey[] = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];

export function fmtTime12h(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return m ? `${h12}:${String(m).padStart(2, '0')} ${period}` : `${h12} ${period}`;
}

/** Consecutive days sharing identical hours collapse into one row (e.g.
 * "Mon–Fri  6 PM – 1 AM") rather than repeating the same hours 7 times. */
export function groupVenueTimings(t: VenueTimingsByDay): { label: string; hours: string }[] {
  const rows: { days: string[]; hours: string }[] = [];
  for (const key of DAY_ORDER) {
    const d = t[key];
    if (!d) continue;
    const hours = d.closed ? 'Closed' : `${fmtTime12h(d.open)} – ${fmtTime12h(d.close)}`;
    const last = rows[rows.length - 1];
    if (last && last.hours === hours) last.days.push(DAY_LABELS[key]);
    else rows.push({ days: [DAY_LABELS[key]], hours });
  }
  return rows.map((r) => ({ label: r.days.length > 1 ? `${r.days[0]}–${r.days[r.days.length - 1]}` : r.days[0], hours: r.hours }));
}

/** Compact "today only" hours for venue cards/previews — e.g. "6 PM – 1 AM"
 * or "Closed today". Returns null when there's no data for today so callers
 * can omit the line entirely rather than showing a blank/broken one (a
 * venue with only the legacy free-text `timings` string has no per-day data
 * to summarize). */
export function todaysVenueHours(t: VenueTimingsByDay | null | undefined, date: Date = new Date()): string | null {
  if (!t) return null;
  const d = t[JS_DAY_TO_KEY[date.getDay()]];
  if (!d) return null;
  return d.closed ? 'Closed today' : `${fmtTime12h(d.open)} – ${fmtTime12h(d.close)} today`;
}
