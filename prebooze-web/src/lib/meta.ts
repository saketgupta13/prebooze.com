declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Fires a Meta Pixel standard/custom event. `fbq` is a queueing stub from
 * the moment index.html runs (same reasoning as gtm.ts's pushEvent) — an
 * early call before fbevents.js has actually loaded is queued, not lost.
 * Use Meta's own standard event names (Purchase, CompleteRegistration,
 * Lead) where one exists so they land in Ads Manager's built-in reporting
 * instead of only showing up as an unrecognized custom event.
 *
 * `eventId`, when passed, must exactly match the `event_id` the matching
 * server-side Conversions API call uses (prebooze-api's MetaConversionsService
 * call sites) — that's what lets Meta dedupe the browser and server copies
 * of the same real-world event into one, instead of double-counting. */
export function trackMeta(name: string, params?: Record<string, unknown>, eventId?: string): void {
  if (typeof window === 'undefined' || !window.fbq) return;
  if (eventId) window.fbq('track', name, params, { eventID: eventId });
  else window.fbq('track', name, params);
}
