import { useEffect, useState } from 'react';

/** Forces a periodic re-render so any Date.now()-based value computed
 * directly in render (cutoff countdowns, free/paid tier state, etc.)
 * stays live without a page reload — same pattern GuestPass.tsx already
 * uses for its own countdown. The returned value isn't meant to be read,
 * just to be a dependency that changes. */
export function useTicker(intervalMs = 5 * 60 * 1000): number {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return tick;
}
