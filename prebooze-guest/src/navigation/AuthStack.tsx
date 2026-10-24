import { createNativeStackNavigator } from '@react-navigation/native-stack';
import PhoneEntryScreen from '../screens/auth/PhoneEntryScreen';
import OtpEntryScreen from '../screens/auth/OtpEntryScreen';
import type { AuthStackParamList } from './types';

const Stack = createNativeStackNavigator<AuthStackParamList>();

export default function AuthStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="PhoneEntry" component={PhoneEntryScreen} />
      <Stack.Screen name="OtpEntry" component={OtpEntryScreen} />
    </Stack.Navigator>
  );
}
