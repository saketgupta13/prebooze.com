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

/** GTM's own click auto-tracking ({{Click URL}}/{{Click Text}}/{{Click
 * Classes}}) reads those live off the clicked DOM element when the tag
 * actually fires — which in a React Router SPA can be after the element's
 * already unmounted by the route change the click triggered, so the tag
 * fires with nothing to read. Capturing the link's data ourselves, in a
 * capture-phase listener (runs before React's own handlers, while the
 * element is still guaranteed to exist) and pushing it as a fully-formed
 * event sidesteps that timing problem entirely — same fix as every other
 * event on this page, just automatic instead of a call site per link.
 * One listener for the whole app; call once at startup. */
export function setupLinkClickTracking(): void {
  if (typeof document === 'undefined') return;
  document.addEventListener(
    'click',
    (e) => {
      const target = (e.target as HTMLElement | null)?.closest('a[href]') as HTMLAnchorElement | null;
      if (!target) return;
      pushEvent('link_click', {
        link_url: target.href,
        link_text: (target.textContent || '').trim().slice(0, 100),
        link_classes: target.className || '',
      });
    },
    true
  );
}
