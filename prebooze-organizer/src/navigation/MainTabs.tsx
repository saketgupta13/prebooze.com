import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Calendar, LayoutDashboard, MoreHorizontal, ScanLine, Users } from 'lucide-react-native';
import DashboardStack from './DashboardStack';
import EventsStack from './EventsStack';
import ScannerScreen from '../screens/scanner/ScannerScreen';
import BookingsStack from './BookingsStack';
import MoreStack from './MoreStack';
import { colors } from '../theme/tokens';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Same 5-tab order the build prompt specifies: Dashboard / Events / Scan /
// Bookings / More. Team-member permission gating on the remaining
// (non-pinned) modules lives inside MoreScreen, same split
// OrganizerLayout.tsx's PINNED_COUNT uses on web.
export default function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarStyle: { backgroundColor: colors.surface, borderTopColor: colors.border },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
      }}
    >
      <Tab.Screen name="Dashboard" component={DashboardStack} options={{ tabBarIcon: ({ color, size }) => <LayoutDashboard color={color} size={size} /> }} />
      <Tab.Screen name="Events" component={EventsStack} options={{ tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }} />
      <Tab.Screen name="Scan" component={ScannerScreen} options={{ tabBarIcon: ({ color, size }) => <ScanLine color={color} size={size} /> }} />
      <Tab.Screen name="Bookings" component={BookingsStack} options={{ tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      <Tab.Screen name="More" component={MoreStack} options={{ tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}
