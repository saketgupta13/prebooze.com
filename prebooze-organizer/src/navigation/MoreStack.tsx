import { createNativeStackNavigator } from '@react-navigation/native-stack';
import MoreScreen from '../screens/more/MoreScreen';
import GuestListScreen from '../screens/guestlist/GuestListScreen';
import LiveMonitorScreen from '../screens/livemonitor/LiveMonitorScreen';
import ReviewsScreen from '../screens/reviews/ReviewsScreen';
import CouponsScreen from '../screens/coupons/CouponsScreen';
import AbandonedCartsScreen from '../screens/abandonedcarts/AbandonedCartsScreen';
import PayoutsScreen from '../screens/payouts/PayoutsScreen';
import WithdrawScreen from '../screens/payouts/WithdrawScreen';
import TransactionsScreen from '../screens/transactions/TransactionsScreen';
import PromotersScreen from '../screens/promoters/PromotersScreen';
import SettingsScreen from '../screens/settings/SettingsScreen';
import TeamRolesScreen from '../screens/settings/TeamRolesScreen';
import VerificationScreen from '../screens/settings/VerificationScreen';
import PaymentProfilesScreen from '../screens/settings/PaymentProfilesScreen';
import type { MoreStackParamList } from './types';

const Stack = createNativeStackNavigator<MoreStackParamList>();

/** Nested inside the More tab (see MainTabs) so pushing any of these
 * screens keeps the bottom tab bar visible — each screen draws its own
 * header (back button + title), so the native stack header stays off. */
export default function MoreStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MoreHome" component={MoreScreen} />
      <Stack.Screen name="GuestList" component={GuestListScreen} />
      <Stack.Screen name="LiveMonitor" component={LiveMonitorScreen} />
      <Stack.Screen name="Reviews" component={ReviewsScreen} />
      <Stack.Screen name="Coupons" component={CouponsScreen} />
      <Stack.Screen name="AbandonedCarts" component={AbandonedCartsScreen} />
      <Stack.Screen name="Payouts" component={PayoutsScreen} />
      <Stack.Screen name="Withdraw" component={WithdrawScreen} />
      <Stack.Screen name="Transactions" component={TransactionsScreen} />
      <Stack.Screen name="Promoters" component={PromotersScreen} />
      <Stack.Screen name="Settings" component={SettingsScreen} />
      <Stack.Screen name="TeamRoles" component={TeamRolesScreen} />
      <Stack.Screen name="Verification" component={VerificationScreen} />
      <Stack.Screen name="PaymentProfiles" component={PaymentProfilesScreen} />
    </Stack.Navigator>
  );
}
