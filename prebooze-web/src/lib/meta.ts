declare global {
  interface Window {
    fbq?: (...args: unknown[]) => void;
  }
}

/** Same literal index.html's inline fbq('init', ...) stub uses — kept here
 * too since this file, not index.html, is where the re-init call for
 * Advanced Matching below needs it. */
const META_PIXEL_ID = '2110355219869761';

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

/** Deliberate (non-automatic) Advanced Matching: re-inits the pixel with the
 * user's phone right after a real WhatsApp OTP verification — a genuine
 * consent moment the user knowingly crosses — instead of the blanket
 * Automatic Advanced Matching toggle, which scrapes every form field with no
 * such moment and is deliberately left off. fbq('init', ...) with a
 * user-data object merges matching info into the pixel's session for every
 * event tracked afterward; the pixel JS hashes it client-side before
 * sending, so pass normalized digits, not a pre-hashed value (unlike the
 * server-side Conversions API call in meta-conversions.service.ts, which
 * does hash locally since no browser JS is there to do it). */
export function setAdvancedMatching(phone: string): void {
  if (typeof window === 'undefined' || !window.fbq) return;
  window.fbq('init', META_PIXEL_ID, { ph: phone.replace(/[^\d]/g, '') });
}
