import { useEffect, useState } from 'react';
import { enabledCountries, statesFor, citiesFor } from '../data/locations';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import SearchableSelect from './SearchableSelect';

export interface LocationValue {
  country: string;
  state: string;
  city: string;
  pincode: string;
}

export const emptyLocation = (): LocationValue => ({ country: 'India', state: '', city: '', pincode: '' });

/** Country → State → City cascading searchable pickers + pincode.
 *
 * City is a special case: it isn't just free-form address data — it's also
 * what the guest site later filters organizers/venues/promoters/lineups by
 * (Home.tsx's `x.city === city` city-scoping). Picking a city here from the
 * old hardcoded ~60-city list meant an applicant could pick a city that
 * doesn't match anything in admin's real, enabled-cities Locations module —
 * they'd onboard successfully but never actually appear on the guest site
 * for anyone, since no visitor's city picker (also real, GET /cities) could
 * ever select a city not in that same enabled list. So City sources from the
 * real GET /cities here too — same call the guest header's city picker
 * already makes — independent of the State cascade below, which stays
 * address-only. Falls back to the old hardcoded state→city list only
 * offline (no backend configured). */
export default function LocationPicker({ value, onChange }: { value: LocationValue; onChange: (v: LocationValue) => void }) {
  const states = statesFor(value.country);
  const [liveCities, setLiveCities] = useState<string[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.cities().then((rows) => setLiveCities(rows.map((r) => r.name).sort())).catch(() => setLiveCities([]));
  }, []);
  const cities = liveCities ?? (isBackendEnabled() ? [] : citiesFor(value.state));

  return (
    <>
      <div className="form-row">
        <div className="field">
          <span>Country</span>
          <SearchableSelect
            value={value.country}
            options={enabledCountries.map((c) => c.name)}
            placeholder="Search country…"
            onChange={(country) => onChange({ ...value, country, state: '', city: '' })}
          />
        </div>
        <div className="field">
          <span>State / region</span>
          {states.length ? (
            <SearchableSelect
              value={value.state}
              options={states}
              placeholder={value.country ? 'Search state…' : 'Pick a country first'}
              disabled={!value.country}
              onChange={(state) => onChange({ ...value, state, city: '' })}
            />
          ) : (
            <input value={value.state} onChange={(e) => onChange({ ...value, state: e.target.value, city: '' })} placeholder="State / region" />
          )}
        </div>
      </div>
      <div className="form-row">
        <div className="field">
          <span>City</span>
          {cities.length ? (
            <SearchableSelect
              value={value.city}
              options={cities}
              placeholder="Search city…"
              onChange={(city) => onChange({ ...value, city })}
            />
          ) : (
            <input value={value.city} onChange={(e) => onChange({ ...value, city: e.target.value })} placeholder="City" />
          )}
        </div>
        <div className="field">
          <span>PIN / ZIP code</span>
          <input
            value={value.pincode}
            onChange={(e) => onChange({ ...value, pincode: e.target.value.replace(/[^0-9A-Za-z ]/g, '').slice(0, 8) })}
            placeholder="e.g. 400001"
            inputMode="numeric"
          />
        </div>
      </div>
    </>
  );
}
