import { useCallback, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Linking, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import * as Notifications from 'expo-notifications';
import { useFonts, Manrope_500Medium, Manrope_600SemiBold, Manrope_700Bold, Manrope_800ExtraBold } from '@expo-google-fonts/manrope';
import { AuthProvider } from './src/context/AuthContext';
import { CityProvider } from './src/context/CityContext';
import RootNavigator from './src/navigation/RootNavigator';
import { navigationRef } from './src/navigation/navigationRef';
import { navigateToNotificationTarget } from './src/lib/notificationNav';
import { navigateToDeepLink } from './src/lib/deepLink';
import { colors } from './src/theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => {});

// Foreground notifications (new event from someone you follow — the core
// of the whole app) should still surface a banner while the app is open.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// Real gap: nothing ever created an Android notification channel, so a
// push arriving while the app is backgrounded/killed had no guaranteed
// importance level to render against — Android can silently downgrade an
// unchanneled notification instead of showing it in the tray with a
// heads-up alert. MAX importance + a real sound/vibration is what actually
// makes a push show up and alert on a real device, matching the "default"
// channel Expo's push payload (push.ts's `sound: 'default'`) targets
// implicitly when none is specified.
if (Platform.OS === 'android') {
  Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: colors.accent,
    sound: 'default',
  }).catch(() => {});
}

async function handleNotificationTap(data: unknown) {
  for (let i = 0; i < 20 && !navigationRef.isReady(); i++) {
    await new Promise((r) => setTimeout(r, 250));
  }
  if (navigationRef.isReady()) navigateToNotificationTarget(navigationRef, data);
}

async function handleDeepLink(url: string) {
  for (let i = 0; i < 20 && !navigationRef.isReady(); i++) {
    await new Promise((r) => setTimeout(r, 250));
  }
  if (navigationRef.isReady()) navigateToDeepLink(navigationRef, url);
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  const onLayout = useCallback(() => {
    if (!fontsLoaded) return;
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        SplashScreen.hideAsync().catch(() => {});
      });
    });
  }, [fontsLoaded]);

  useEffect(() => {
    onLayout();
  }, [onLayout]);

  useEffect(() => {
    Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleNotificationTap(response.notification.request.content.data);
    });
    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      handleNotificationTap(response.notification.request.content.data);
    });
    return () => sub.remove();
  }, []);

  // A promoter's shared event link — opened cold (app wasn't running) via
  // getInitialURL, or tapped while the app was already open via the 'url'
  // event. Same two-case handling as the push-notification-tap flow above.
  useEffect(() => {
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink(url);
    });
    const sub = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });
    return () => sub.remove();
  }, []);

  if (!fontsLoaded) return null;

  return (
    <SafeAreaProvider>
      <View style={{ flex: 1, backgroundColor: colors.bg }} onLayout={onLayout}>
        <AuthProvider>
          <CityProvider>
            <RootNavigator />
          </CityProvider>
        </AuthProvider>
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}
