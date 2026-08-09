declare global {
  interface Window {
    dataLayer?: Record<string, unknown>[];
  }
}

/** Pushes a GA4-shaped event into the dataLayer GTM (see index.html) reads
 * from — the array exists before GTM has actually loaded (index.html sets
 * it up unconditionally), so an early push just queues the same way
 * gtag()'s own snippet does; nothing is lost to load-order timing. Use
 * GA4's standard event names/params where one exists (purchase, sign_up,
 * login) so they land in GA4's built-in reports instead of needing a
 * custom report configured for them. */
export function pushEvent(name: string, params?: Record<string, unknown>): void {
  if (typeof window === 'undefined' || !window.dataLayer) return;
  window.dataLayer.push({ event: name, ...params });
}
