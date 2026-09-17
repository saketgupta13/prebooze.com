import { useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { AuthProvider } from './src/context/AuthContext';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { navigateToNotificationTarget } from './src/lib/notificationNav';
import { colors } from './src/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Foreground notifications (new booking, refund, review, payout, low
// stock, cart recovered — see build prompt's push-notification scope)
// should still surface a banner while the app is open, not get swallowed.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Real bug found live: tapping a push notification from the Android tray
 * just opened the app to the Dashboard, never the screen it was actually
 * about (organizer feedback 2026-09-17) — nothing here ever read the `to`
 * field OrgNotificationsService.notify()/seedDemo() already sends as push
 * `data`. Handles all three ways a tap can reach the app: already running
 * in the foreground, backgrounded (process alive), and fully killed (cold
 * start) — the last two need `navigationRef` since no screen's own
 * useNavigation() hook exists yet when the tap arrives. `isReady()` can be
 * false for a moment after a cold start while AuthContext's boot check is
 * still in flight (MainTabs isn't mounted yet), so this polls briefly
 * rather than silently dropping the deep link. */
async function handleNotificationTap(to: unknown) {
  if (typeof to !== 'string') return;
  for (let i = 0; i < 20 && !navigationRef.isReady(); i++) {
    await new Promise((r) => setTimeout(r, 250));
  }
  if (navigationRef.isReady()) navigateToNotificationTarget(navigationRef, to);
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  const onLayout = useCallback(async () => {
    if (fontsLoaded) await SplashScreen.hideAsync();
  }, [fontsLoaded]);

  useEffect(() => {
    onLayout();
  }, [onLayout]);

  useEffect(() => {
    // Cold start: app was killed, the tap is what launched it — the live
    // listener below never fires for this case since it wasn't registered
    // in time, so the last response has to be checked explicitly once.
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationTap(response.notification.request.content.data?.to);
    });
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationTap(response.notification.request.content.data?.to);
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={onLayout}>
        <AuthProvider>
          <RootNavigator />
        </AuthProvider>
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}
