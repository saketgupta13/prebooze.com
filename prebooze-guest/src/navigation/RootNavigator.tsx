import { useRef } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { navigationRef } from './navigationRef';
import { linking } from './linking';
import { trackScreenView } from '../lib/analytics';
import SplashOverlay from '../components/SplashOverlay';
import AuthStack from './AuthStack';
import MainTabs from './MainTabs';
import EventDetailScreen from '../screens/eventdetail/EventDetailScreen';
import DeleteAccountScreen from '../screens/profile/DeleteAccountScreen';
import CheckoutScreen from '../screens/checkout/CheckoutScreen';
import BookingConfirmedScreen from '../screens/checkout/BookingConfirmedScreen';
import BookingDetailScreen from '../screens/bookings/BookingDetailScreen';
import OrganizerProfileScreen from '../screens/directories/OrganizerProfileScreen';
import VenueProfileScreen from '../screens/directories/VenueProfileScreen';
import LineupProfileScreen from '../screens/directories/LineupProfileScreen';
import PromoterProfileScreen from '../screens/directories/PromoterProfileScreen';
import VenuesDirectoryScreen from '../screens/directories/VenuesDirectoryScreen';
import OrganizersDirectoryScreen from '../screens/directories/OrganizersDirectoryScreen';
import LineupsDirectoryScreen from '../screens/directories/LineupsDirectoryScreen';
import PromotersDirectoryScreen from '../screens/directories/PromotersDirectoryScreen';
import CategoriesScreen from '../screens/directories/CategoriesScreen';
import PersonProfileScreen from '../screens/people/PersonProfileScreen';
import BrowseScreen from '../screens/home/BrowseScreen';
import GuestListLandingScreen from '../screens/guestlist/GuestListLandingScreen';
import GuestPassScreen from '../screens/guestlist/GuestPassScreen';
import EditProfileScreen from '../screens/profile/EditProfileScreen';
import FinishProfileScreen from '../screens/profile/FinishProfileScreen';
import WishlistScreen from '../screens/profile/WishlistScreen';
import WalletScreen from '../screens/profile/WalletScreen';
import ReferEarnScreen from '../screens/profile/ReferEarnScreen';
import PaymentMethodsScreen from '../screens/profile/PaymentMethodsScreen';
import NotificationSettingsScreen from '../screens/profile/NotificationSettingsScreen';
import NotificationsScreen from '../screens/profile/NotificationsScreen';
import HelpCenterScreen from '../screens/profile/HelpCenterScreen';
import PrivacyPolicyScreen from '../screens/profile/PrivacyPolicyScreen';
import AboutPrebozeScreen from '../screens/profile/AboutPrebozeScreen';
import FollowingScreen from '../screens/people/FollowingScreen';
import PlaceholderScreen from '../screens/PlaceholderScreen';
import ReferralLandingScreen from '../screens/referral/ReferralLandingScreen';
import type { RootStackParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();

// Screens designed (see the design canvas) but not yet wired to real data —
// PlaceholderScreen keeps every nav target functional while these get
// built out incrementally. Empty now — FinishProfile (profile-completion
// reward flow) was the only one left here and is now real.
const PLACEHOLDER_SCREENS: (keyof RootStackParamList)[] = [];

export default function RootNavigator() {
  const { user, bootLoading } = useAuth();
  const prevRouteName = useRef<string | undefined>(undefined);

  if (bootLoading) {
    return <SplashOverlay />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      linking={linking}
      // GA4 expects a screen_view per navigation, same reasoning as web's
      // trackPageView firing on every React Router route change — the
      // current route name (not the whole nested state tree) is all a
      // comparable "page" identity needs, same granularity web's
      // page_path gives.
      onStateChange={() => {
        const name = navigationRef.getCurrentRoute()?.name;
        if (name && name !== prevRouteName.current) {
          prevRouteName.current = name;
          trackScreenView(name);
        }
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {!user ? (
          <>
            <Stack.Screen name="Auth" component={AuthStack} />
            <Stack.Screen name="ReferralLanding" component={ReferralLandingScreen} />
            {/* Real gap: a promoter's free-entry guest-list link is
                deliberately public on web (no account needed — the whole
                point is frictionless sign-up for Nagpur's cash-door "free
                entry" crowd), but these were only ever registered in the
                logged-in branch here, so tapping the link with the app
                installed but not logged in silently dropped it on the
                phone-login screen. Both screens already treat `user` as
                fully optional (GuestListLandingScreen pre-fills name/phone
                only if logged in; GuestPassScreen has no auth dependency
                at all), so this is just making them reachable. */}
            <Stack.Screen name="GuestListLanding" component={GuestListLandingScreen} />
            <Stack.Screen name="GuestPass" component={GuestPassScreen} options={{ gestureEnabled: false }} />
          </>
        ) : (
          <>
            <Stack.Screen name="Main" component={MainTabs} />
            <Stack.Screen name="EventDetail" component={EventDetailScreen} />
            <Stack.Screen name="DeleteAccount" component={DeleteAccountScreen} />
            <Stack.Screen name="Checkout" component={CheckoutScreen} />
            <Stack.Screen name="BookingConfirmed" component={BookingConfirmedScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
            <Stack.Screen name="OrganizerProfile" component={OrganizerProfileScreen} />
            <Stack.Screen name="VenueProfile" component={VenueProfileScreen} />
            <Stack.Screen name="LineupProfile" component={LineupProfileScreen} />
            <Stack.Screen name="PromoterProfile" component={PromoterProfileScreen} />
            <Stack.Screen name="VenuesDirectory" component={VenuesDirectoryScreen} />
            <Stack.Screen name="OrganizersDirectory" component={OrganizersDirectoryScreen} />
            <Stack.Screen name="LineupsDirectory" component={LineupsDirectoryScreen} />
            <Stack.Screen name="PromotersDirectory" component={PromotersDirectoryScreen} />
            <Stack.Screen name="Categories" component={CategoriesScreen} />
            <Stack.Screen name="GuestListLanding" component={GuestListLandingScreen} />
            <Stack.Screen name="GuestPass" component={GuestPassScreen} options={{ gestureEnabled: false }} />
            <Stack.Screen name="PersonProfile" component={PersonProfileScreen} />
            <Stack.Screen name="Browse" component={BrowseScreen} />
            <Stack.Screen name="EditProfile" component={EditProfileScreen} />
            <Stack.Screen name="Wishlist" component={WishlistScreen} />
            <Stack.Screen name="Wallet" component={WalletScreen} />
            <Stack.Screen name="ReferEarn" component={ReferEarnScreen} />
            <Stack.Screen name="PaymentMethods" component={PaymentMethodsScreen} />
            <Stack.Screen name="NotificationSettings" component={NotificationSettingsScreen} />
            <Stack.Screen name="Notifications" component={NotificationsScreen} />
            <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
            <Stack.Screen name="PrivacyPolicy" component={PrivacyPolicyScreen} />
            <Stack.Screen name="AboutPrebooze" component={AboutPrebozeScreen} />
            <Stack.Screen name="Following" component={FollowingScreen} />
            <Stack.Screen name="FinishProfile" component={FinishProfileScreen} />
            <Stack.Screen name="ReferralLanding" component={ReferralLandingScreen} />
            {PLACEHOLDER_SCREENS.map((name) => (
              <Stack.Screen key={name} name={name} component={PlaceholderScreen} />
            ))}
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
