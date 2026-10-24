import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Home as HomeIcon, Ticket, User, Users } from 'lucide-react-native';
import HomeScreen from '../screens/home/HomeScreen';
import PeopleScreen from '../screens/people/PeopleScreen';
import BookingsScreen from '../screens/bookings/BookingsScreen';
import ProfileScreen from '../screens/profile/ProfileScreen';
import { colors, fontFamily } from '../theme/tokens';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

export default function MainTabs() {
  // Android devices with the gesture-nav pill (or 3-button nav) draw it
  // over a fixed-height tab bar since that height doesn't account for the
  // bottom safe-area inset — padding the bar itself by insets.bottom so the
  // pill/buttons sit below the tab icons instead of on top of them.
  //
  // Real bug (2026-10-21): insets.bottom alone wasn't enough on a real
  // device — some OEM skins' gesture pill still visually sits close enough
  // to clip the icon row even when react-native-safe-area-context reports
  // little/no inset there. A hard minimum floor (not just whatever insets
  // happens to report) guarantees real breathing room between the icons
  // and the system nav area regardless of what the inset measurement says.
  const insets = useSafeAreaInsets();
  const bottomPad = Math.max(insets.bottom, 16);
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.bg, borderTopColor: colors.border, height: 58 + bottomPad, paddingTop: 10, paddingBottom: bottomPad },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted2,
        tabBarLabelStyle: { fontFamily: fontFamily.bold, fontSize: 10.5 },
      }}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ tabBarIcon: ({ color, size }) => <HomeIcon color={color} size={size} /> }} />
      <Tab.Screen name="People" component={PeopleScreen} options={{ tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      <Tab.Screen name="Bookings" component={BookingsScreen} options={{ tabBarIcon: ({ color, size }) => <Ticket color={color} size={size} /> }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ tabBarIcon: ({ color, size }) => <User color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}
