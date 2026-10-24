import { useEffect, useState } from 'react';

/** Forces a periodic re-render so any Date.now()-based value computed
 * directly in render (free-tier cutoff countdowns) stays live without a
 * reload. Ports prebooze-web/src/lib/useTicker.ts verbatim. The returned
 * value isn't meant to be read, just to be a dependency that changes. */
export function useTicker(intervalMs = 60 * 1000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return tick;
}
