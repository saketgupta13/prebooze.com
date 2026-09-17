import { createNavigationContainerRef } from '@react-navigation/native';
import type { MainTabParamList } from './types';

/** Lets code outside the React tree (App.tsx's OS-notification-tap handler)
 * navigate the same way a screen's own useNavigation() hook would — needed
 * because a notification tap can cold-start the app before any screen has
 * mounted to grab a hook-based navigation object from. */
export const navigationRef = createNavigationContainerRef<MainTabParamList>();
