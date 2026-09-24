import { createNativeStackNavigator } from '@react-navigation/native-stack';
import BookingsScreen from '../screens/bookings/BookingsScreen';
import BookingDetailScreen from '../screens/bookings/BookingDetailScreen';
import type { BookingsStackParamList } from './types';

const Stack = createNativeStackNavigator<BookingsStackParamList>();

/** Nested inside the Bookings tab (see MainTabs), same reasoning as
 * EventsStack — pushing the detail screen keeps the bottom tab bar visible. */
export default function BookingsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="BookingsList" component={BookingsScreen} />
      <Stack.Screen name="BookingDetail" component={BookingDetailScreen} />
    </Stack.Navigator>
  );
}
