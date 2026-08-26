const IST_OFFSET_MIN = 5.5 * 60;

/** "YYYY-MM-DD" for the IST calendar day a UTC instant falls on — the
 * server runs in UTC, but every daily report/trend/invoice date on an
 * India-only platform should bucket by the IST business day, not UTC's
 * (a booking at 1am IST is 7:30pm UTC the *previous* day). Same
 * IST_OFFSET_MIN anchoring as ticket-tier-pricing.ts — India has no DST,
 * so a fixed offset is always correct. */
export function istDateKey(d: Date): string {
  const ist = new Date(d.getTime() + IST_OFFSET_MIN * 60000);
  const y = ist.getUTCFullYear();
  const m = String(ist.getUTCMonth() + 1).padStart(2, '0');
  const day = String(ist.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** The UTC instant of IST midnight for a bare "YYYY-MM-DD" day — for a
 * date-range filter's `gte` boundary. A bare ISO date string parses as
 * *UTC* midnight per spec (5.5h too late for what an IST business day
 * actually starts at), so this needs the explicit +05:30 offset rather
 * than `new Date(dateStr)`. */
export function istDayStart(dateStr: string): Date {
  return new Date(`${dateStr}T00:00:00+05:30`);
}

/** The UTC instant of IST 23:59:59.999 for a bare "YYYY-MM-DD" day — for a
 * date-range filter's `lte` boundary. Same reasoning as istDayStart: a
 * naive UTC-midnight-based end would run 5.5h into the *next* IST day
 * instead of ending where the selected day actually ends. */
export function istDayEnd(dateStr: string): Date {
  return new Date(`${dateStr}T23:59:59.999+05:30`);
}
