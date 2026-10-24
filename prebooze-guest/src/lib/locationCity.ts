import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';

const ASKED_KEY = 'pb_location_asked';

/** Prompts for device location once — ever — the very first time the app
 * has nothing better to go on (no cached city pref, no account city yet).
 * The OS itself already refuses to re-prompt once a guest has answered the
 * native permission dialog, so this flag isn't working around that; it's
 * there so a *denied* guest doesn't see this same code try
 * getCurrentPositionAsync again on every subsequent cold start (that call
 * would just reject every time, uselessly, once denied).
 *
 * Reverse-geocodes to a city name and fuzzy-matches it against
 * Prebooze's own real city list (whatever catalog.cities() returns right
 * now — never a hardcoded guess) rather than assuming the device's city
 * string matches Prebooze's naming exactly. Returns null on any failure
 * (no permission, no GPS fix, no match) — the existing Nagpur/account-city
 * fallback in CityContext already handles that case fine. */
export async function detectCityFromLocation(supportedCities: string[]): Promise<string | null> {
  try {
    const already = await AsyncStorage.getItem(ASKED_KEY);
    if (already) return null;
    await AsyncStorage.setItem(ASKED_KEY, '1');

    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;

    const pos = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const places = await Location.reverseGeocodeAsync({ latitude: pos.coords.latitude, longitude: pos.coords.longitude });
    const deviceCity = places[0]?.city?.toLowerCase().trim();
    if (!deviceCity) return null;

    const match = supportedCities.find((c) => c.toLowerCase() === deviceCity)
      ?? supportedCities.find((c) => c.toLowerCase().includes(deviceCity) || deviceCity.includes(c.toLowerCase()));
    return match ?? null;
  } catch {
    return null; // best-effort — never blocks app usage over a location failure
  }
}
