import { useEffect } from 'react';

/** Injects a <script type="application/ld+json"> tag for the current page
 * — Schema.org structured data, invisible to guests but what Google reads
 * to build rich results (event cards/carousels, breadcrumbs in search,
 * knowledge panel data). Stringified once outside the effect so a fresh
 * object literal every render doesn't re-run it — only a real content
 * change does. Removed on unmount so an SPA navigation never leaves a
 * stale page's structured data attached to the next one. */
export function useJsonLd(data: object | object[] | null | undefined) {
  const json = data ? JSON.stringify(data) : null;

  useEffect(() => {
    if (!json) return;
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.textContent = json;
    document.head.appendChild(script);
    return () => {
      document.head.removeChild(script);
    };
  }, [json]);
}
