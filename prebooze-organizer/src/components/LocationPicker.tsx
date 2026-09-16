import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Input, Txt } from './ui';
import SearchableSelect from './SearchableSelect';
import { catalog } from '../api/catalog';
import { enabledCountries, statesFor, citiesFor } from '../lib/locations';
import { spacing, fontSize } from '../theme/tokens';

export interface LocationValue {
  country: string;
  state: string;
  city: string;
  pincode: string;
}

export const emptyLocation = (): LocationValue => ({ country: 'India', state: '', city: '', pincode: '' });

/** Faithful port of prebooze-web/src/components/LocationPicker.tsx —
 * Country → State → City cascading pickers + pincode. City sources from the
 * real GET /cities (state-linked, admin-managed) so a picked city always
 * matches what the guest site's own city filter recognizes; falls back to
 * the static state→city list only if that call fails or the state has no
 * real cities yet. Selecting a new country resets state+city; a new state
 * resets city. */
export default function LocationPicker({ value, onChange }: { value: LocationValue; onChange: (v: LocationValue) => void }) {
  const states = statesFor(value.country);
  const [liveCities, setLiveCities] = useState<{ name: string; state?: string }[] | null>(null);

  useEffect(() => {
    catalog.cities().then((rows) => setLiveCities([...rows].sort((a, b) => a.name.localeCompare(b.name)))).catch(() => setLiveCities([]));
  }, []);

  const cities = liveCities
    ? liveCities.filter((c) => !value.state || c.state === value.state).map((c) => c.name)
    : citiesFor(value.state);

  return (
    <View>
      <View style={styles.row}>
        <View style={styles.field}>
          <Txt style={styles.label}>Country</Txt>
          <SearchableSelect
            value={value.country}
            options={enabledCountries.map((c) => c.name)}
            placeholder="Search country…"
            onChange={(country) => onChange({ ...value, country, state: '', city: '' })}
          />
        </View>
        <View style={styles.field}>
          <Txt style={styles.label}>State / region</Txt>
          {states.length ? (
            <SearchableSelect
              value={value.state}
              options={states}
              placeholder={value.country ? 'Search state…' : 'Pick a country first'}
              onChange={(state) => onChange({ ...value, state, city: '' })}
            />
          ) : (
            <Input value={value.state} onChangeText={(t) => onChange({ ...value, state: t, city: '' })} placeholder="State / region" />
          )}
        </View>
      </View>
      <View style={styles.row}>
        <View style={styles.field}>
          <Txt style={styles.label}>City</Txt>
          {cities.length ? (
            <SearchableSelect
              value={value.city}
              options={cities}
              placeholder="Search city…"
              onChange={(city) => onChange({ ...value, city })}
            />
          ) : (
            <Input value={value.city} onChangeText={(t) => onChange({ ...value, city: t })} placeholder="City" />
          )}
        </View>
        <View style={styles.field}>
          <Txt style={styles.label}>PIN / ZIP code</Txt>
          <Input
            value={value.pincode}
            onChangeText={(t) => onChange({ ...value, pincode: t.replace(/[^0-9A-Za-z ]/g, '').slice(0, 8) })}
            placeholder="e.g. 400001"
            keyboardType="number-pad"
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.s, marginBottom: spacing.m },
  field: { flex: 1 },
  label: { fontSize: fontSize.s, marginBottom: 6 },
});
