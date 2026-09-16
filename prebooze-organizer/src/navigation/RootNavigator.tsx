import { NavigationContainer, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import PhoneEntryScreen from '../screens/auth/PhoneEntryScreen';
import OtpEntryScreen from '../screens/auth/OtpEntryScreen';
import { NotOrganizerScreen, PendingReviewScreen, RejectedReviewScreen } from '../screens/auth/StatusScreens';
import MainTabs from './MainTabs';
import { colors } from '../theme/tokens';
import type { AuthStackParamList } from './types';

const AuthStack = createNativeStackNavigator<AuthStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: { ...DarkTheme.colors, background: colors.bg, card: colors.surface, border: colors.border, text: colors.text, primary: colors.accent },
};

/** Swaps between the login stack, a status screen (pending/rejected/not an
 * organizer), and the real tab console — mirrors OrganizerLayout.tsx's
 * gate exactly (see AuthContext.accessState). */
export default function RootNavigator() {
  const { accessState } = useAuth();

  if (accessState.kind === 'loading') {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer theme={navTheme}>
      {accessState.kind === 'owner' || accessState.kind === 'team' ? (
        <MainTabs />
      ) : accessState.kind === 'pending' ? (
        <PendingReviewScreen />
      ) : accessState.kind === 'rejected' ? (
        <RejectedReviewScreen reason={accessState.reason} />
      ) : (
        <AuthGate />
      )}
    </NavigationContainer>
  );
}

/** `not_organizer` covers two real cases: never logged in (show the phone/
 * OTP stack) and logged in but no organizer application on file at all
 * (show the redirect-to-web screen). AuthContext exposes `user` for this
 * distinction. */
function AuthGate() {
  const { user } = useAuth();
  if (user) return <NotOrganizerScreen />;
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
      <AuthStack.Screen name="OtpEntry" component={OtpEntryScreen} />
    </AuthStack.Navigator>
  );
}
