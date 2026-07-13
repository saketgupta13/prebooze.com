import { enabledCountries, statesFor, citiesFor } from '../data/locations';
import SearchableSelect from './SearchableSelect';

export interface LocationValue {
  country: string;
  state: string;
  city: string;
  pincode: string;
}

export const emptyLocation = (): LocationValue => ({ country: 'India', state: '', city: '', pincode: '' });

/** Country → State → City cascading searchable pickers + pincode. */
export default function LocationPicker({ value, onChange }: { value: LocationValue; onChange: (v: LocationValue) => void }) {
  const states = statesFor(value.country);
  const cities = citiesFor(value.state);

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
              placeholder={value.state ? 'Search city…' : 'Pick a state first'}
              disabled={!value.state}
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
