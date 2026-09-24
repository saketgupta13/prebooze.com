import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Calendar, LayoutDashboard, MoreHorizontal, ScanLine, Users } from 'lucide-react-native';
import DashboardStack from './DashboardStack';
import EventsStack from './EventsStack';
import ScannerScreen from '../screens/scanner/ScannerScreen';
import BookingsStack from './BookingsStack';
import MoreStack from './MoreStack';
import { useAuth } from '../context/AuthContext';
import { colors } from '../theme/tokens';
import type { MainTabParamList } from './types';

const Tab = createBottomTabNavigator<MainTabParamList>();

// Same 5-tab order the build prompt specifies: Dashboard / Events / Scan /
// Bookings / More, now actually gated per-role — same reasoning as web's
// OrganizerLayout.tsx canView/visibleNav (a permission-restricted team
// member used to always see all 5 tabs regardless of role, then hit a real
// 403 the moment a gated screen tried to load; organizer feedback
// 2026-09-24 "Door staff can't see the main dashboard" traced back to
// exactly this — the tab was always reachable, but nothing inside it
// tolerated the 403). Dashboard and More stay unconditional (Dashboard's
// own module defaults to view:true for every role; More's individual rows
// are already gated by MoreScreen's own canView). Scan is gated on the
// team member's `scan` flag (OrgStaff.scan), the same boolean the invite
// form itself sets — not a module permission, since scanning at the gate
// isn't naturally bundled with any of the Attendees & check-in screens.
export default function MainTabs() {
  const { accessState } = useAuth();
  const canView = (module: string) => {
    if (accessState.kind === 'owner') return true;
    if (accessState.kind === 'team') return !!accessState.access.permissions[module]?.view;
    return false;
  };
  const canScan = accessState.kind === 'owner' || (accessState.kind === 'team' && accessState.access.scan);

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
      {canView('Events & wizard') && (
        <Tab.Screen name="Events" component={EventsStack} options={{ tabBarIcon: ({ color, size }) => <Calendar color={color} size={size} /> }} />
      )}
      {canScan && (
        <Tab.Screen name="Scan" component={ScannerScreen} options={{ tabBarIcon: ({ color, size }) => <ScanLine color={color} size={size} /> }} />
      )}
      {canView('Attendees & check-in') && (
        <Tab.Screen name="Bookings" component={BookingsStack} options={{ tabBarIcon: ({ color, size }) => <Users color={color} size={size} /> }} />
      )}
      <Tab.Screen name="More" component={MoreStack} options={{ tabBarIcon: ({ color, size }) => <MoreHorizontal color={color} size={size} /> }} />
    </Tab.Navigator>
  );
}
