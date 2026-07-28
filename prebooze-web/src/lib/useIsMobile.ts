import { useEffect, useState } from 'react';

/** Tracks whether the viewport is at or below the same breakpoint the rest
 * of the app uses for nav collapse / mobile search relocation (960px) — for
 * behavior that has to branch in JS, not just CSS (e.g. the event ticket
 * box being a fixed bottom sheet on mobile but a normal sticky sidebar on
 * desktop — too different a layout to express as one markup tree with
 * pure CSS overrides). */
export function useIsMobile(breakpoint = 960): boolean {
  const query = `(max-width: ${breakpoint}px)`;
  const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(query).matches : false));
  useEffect(() => {
    const mq = window.matchMedia(query);
    const handler = () => setIsMobile(mq.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [query]);
  return isMobile;
}
