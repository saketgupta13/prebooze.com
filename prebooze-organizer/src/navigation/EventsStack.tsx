import { createNativeStackNavigator } from '@react-navigation/native-stack';
import EventsScreen from '../screens/events/EventsScreen';
import EventWizardScreen from '../screens/eventwizard/EventWizardScreen';
import MarketingAnalyticsScreen from '../screens/events/MarketingAnalyticsScreen';
import type { EventsStackParamList } from './types';

const Stack = createNativeStackNavigator<EventsStackParamList>();

/** Nested inside the Events tab (see MainTabs) so pushing the wizard keeps
 * the bottom tab bar visible — each screen draws its own header (back
 * button + title), so the native stack header stays off. */
export default function EventsStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="EventsList" component={EventsScreen} />
      <Stack.Screen name="EventWizard" component={EventWizardScreen} />
      <Stack.Screen name="MarketingAnalytics" component={MarketingAnalyticsScreen} />
    </Stack.Navigator>
  );
}
