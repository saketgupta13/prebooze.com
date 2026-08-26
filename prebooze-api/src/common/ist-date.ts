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
