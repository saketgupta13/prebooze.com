import { useEffect, useState } from 'react';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import { TOP_CITIES, EVENTS, venueById } from '../data/mock';

export interface CityRow {
  name: string;
  icon?: string;
  top: boolean;
  events: number;
  venues: number;
}

let cache: CityRow[] | null = null;
let inflight: Promise<CityRow[]> | null = null;

const mockRows = (): CityRow[] => {
  const counts = new Map<string, number>();
  EVENTS.filter((e) => e.status === 'approved').forEach((e) => {
    const c = (e.venueId ? venueById(e.venueId)?.city : e.privateCity) ?? undefined;
    if (c) counts.set(c, (counts.get(c) ?? 0) + 1);
  });
  return TOP_CITIES.map((t) => ({ name: t.name, icon: t.icon, top: true, events: counts.get(t.name) ?? 0, venues: 0 }));
};

/** The real, admin-managed city list (Admin > Locations, GET /cities) —
 * shared by CityPicker (the switcher UI) and CityScope (resolving the
 * URL's :city segment on every navigation), so it's fetched once, eagerly,
 * and cached module-level rather than re-fetched per-mount. CityPicker
 * used to fetch this lazily on open; CityScope needs it on essentially
 * every page load, so lazy-on-open would mean it blocking navigation on a
 * fresh network round trip most of the time. */
export function useCityList(): { cities: CityRow[] | null } {
  const [cities, setCities] = useState<CityRow[] | null>(cache);

  useEffect(() => {
    if (cache) return;
    if (!isBackendEnabled()) {
      cache = mockRows();
      setCities(cache);
      return;
    }
    if (!inflight) {
      inflight = catalog
        .cities()
        .then((rows) => {
          cache = rows;
          return rows;
        })
        .catch(() => {
          cache = [];
          return [];
        });
    }
    inflight.then(setCities);
  }, []);

  return { cities };
}
