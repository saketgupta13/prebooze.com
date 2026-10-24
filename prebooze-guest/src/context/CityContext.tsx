import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useAuth } from './AuthContext';
import { catalog } from '../api/catalog';
import { detectCityFromLocation } from '../lib/locationCity';

const CITY_KEY = 'pb_browsing_city';

/** The guest's chosen browsing city — same concept as web's AppContext
 * `city`/`setCity` (store/AppContext.tsx): purely local, independent of
 * the account's own `User.city` on the backend, persisted (there:
 * localStorage 'pb_city'; here: SecureStore) so it survives app restarts.
 * Defaults to the account's city once known, falling back to Nagpur
 * (Prebooze's current real-launch city) if neither is set yet. */
interface CityContextValue {
  city: string;
  setCity: (c: string) => void;
}

const CityContext = createContext<CityContextValue | null>(null);

export function CityProvider({ children }: { children: ReactNode }) {
  const { user, bootLoading } = useAuth();
  const [city, setCityState] = useState('Nagpur');

  useEffect(() => {
    if (bootLoading) return;
    SecureStore.getItemAsync(CITY_KEY).then(async (cached) => {
      if (cached) { setCityState(cached); return; }
      if (user?.city) { setCityState(user.city); return; }
      // Nothing to go on yet (no cached pref, no account city) — this is
      // as close to "first ever launch" as this context can tell, the
      // right moment to ask for location rather than silently defaulting
      // to Nagpur for every brand-new guest regardless of where they
      // actually are.
      setCityState('Nagpur');
      try {
        const cities = await catalog.cities();
        const detected = await detectCityFromLocation(cities.map((c) => c.name));
        if (detected) setCity(detected);
      } catch {
        // best-effort — Nagpur fallback above already stands
      }
    });
    // Runs once, right after auth's own boot check resolves (so user.city
    // is settled) — a later login/logout doesn't re-trigger this; the
    // explicit setCity below is the only thing that changes it after that.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bootLoading]);

  const setCity = (c: string) => {
    setCityState(c);
    SecureStore.setItemAsync(CITY_KEY, c).catch(() => {});
  };

  return <CityContext.Provider value={{ city, setCity }}>{children}</CityContext.Provider>;
}

export function useCity(): CityContextValue {
  const ctx = useContext(CityContext);
  if (!ctx) throw new Error('useCity must be used within CityProvider');
  return ctx;
}
