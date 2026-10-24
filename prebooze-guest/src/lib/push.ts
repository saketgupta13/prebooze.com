import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { auth } from '../api/auth';

/** Fetches this device's real Expo push token (if permission was already
 * granted — never prompts here, AuthContext.verifyOtp owns the prompt) and
 * registers it against the logged-in guest. Same pattern as
 * prebooze-organizer/src/lib/push.ts — identical push relay (Expo ->
 * APNs/FCM), identical PushToken table, just a guest-owned token instead of
 * an organizer-owned one. */
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
    await auth.registerPushToken(token, platform);
    return token;
  } catch (err) {
    if (__DEV__) console.warn('[push] registration failed', err);
    return null;
  }
}

export async function unregisterPushToken(token: string | null): Promise<void> {
  if (!token) return;
  try {
    await auth.unregisterPushToken(token);
  } catch {
    // best-effort — a stale token left registered after logout just means
    // one dead-account push attempt later, which PushService's Expo
    // DeviceNotRegistered cleanup already handles on the backend.
  }
}
