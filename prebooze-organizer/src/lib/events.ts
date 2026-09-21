// Same formula as prebooze-api's CatalogService.isEventOver / prebooze-web's
// mock.ts mirror — an event is "over" once its window has fully elapsed,
// not just once it's started. For a multi-day series (seriesEndDate set),
// the window extends through the end of that day instead of just the first
// session's date+durationHrs (2026-09-21 — this field didn't exist when
// this helper was first written and duplicated identically across 8 RN
// screens; a real event would've shown "ended" the moment day one's window
// passed, even mid-series). Kept as a single shared export specifically
// because that duplication is exactly what let this drift the first time.
export const isEventOver = (e: { date: string; durationHrs: number; seriesEndDate?: string | null }, now = Date.now()) => {
  if (e.seriesEndDate) return new Date(e.seriesEndDate).getTime() + 24 * 3600_000 < now;
  return new Date(e.date).getTime() + e.durationHrs * 3600_000 < now;
};
