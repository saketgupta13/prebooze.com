import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { organizer } from '../api/organizer';

/** Fetches this device's real Expo push token (if permission was already
 * granted — never prompts here, `AuthContext.verifyOtp` owns the prompt) and
 * registers it against the logged-in organizer via POST /organizer/push-token.
 * Returns the token on success so the caller can hang onto it for a later
 * `unregisterPushToken` call at logout, or `null` if nothing was registered
 * (permission not granted, or no EAS `projectId` configured yet — see below).
 *
 * `getExpoPushTokenAsync` needs an EAS `projectId` to mint a real token
 * outside of Expo Go; this app was built via `expo run:android` (no EAS
 * project linked yet), so until one exists this fails fast with a clear dev
 * log instead of crashing — the backend endpoint is real and ready, this is
 * purely a "not yet EAS-linked" gap on the client. */
export async function registerPushTokenForCurrentDevice(): Promise<string | null> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return null;

    const projectId = Constants.expoConfig?.extra?.eas?.projectId as string | undefined;
    if (!projectId) {
      if (__DEV__) console.warn('[push] no EAS projectId configured yet — skipping push-token registration');
      return null;
    }

    const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await organizer.registerPushToken(token, platform);
    return token;
  } catch (err) {
    if (__DEV__) console.warn('[push] registration failed', err);
    return null;
  }
}

export async function unregisterPushToken(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await organizer.unregisterPushToken(token);
  } catch {
    // best-effort — a stale token left registered after logout just means
    // one dead-account push attempt later, which PushService's Expo
    // DeviceNotRegistered cleanup already handles on the backend.
  }
}
