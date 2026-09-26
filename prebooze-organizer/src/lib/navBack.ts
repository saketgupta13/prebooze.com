/** Real bug fixed 2026-09-26: every screen's back button called
 * `navigation.goBack()` unconditionally, which assumes there's always a
 * screen underneath in the *current* nested stack. That's true when a
 * screen is reached by tapping through from its own tab's home screen
 * (e.g. More → MoreHome → AbandonedCarts), but not when it's reached by a
 * deep link — notificationNav.ts's `nav('More', { screen: 'AbandonedCarts'
 * })` cold-navigates directly into a not-yet-mounted nested stack, and
 * React Navigation initializes that stack with ONLY the target screen —
 * no `MoreHome` underneath it — so `goBack()` has nothing to pop and either
 * no-ops or falls back to whatever tab was previously focused (organizer
 * feedback: "not allowing me go back to settings page"). Use this in place
 * of a bare `navigation.goBack()` on any screen reachable via a
 * notification deep link; it falls back to that screen's own tab home
 * instead of guessing wrong. */
export function goBackOrHome(navigation: { canGoBack: () => boolean; goBack: () => void; navigate: (name: never, params?: object) => void }, tab: string, homeScreen: string) {
  if (navigation.canGoBack()) {
    navigation.goBack();
  } else {
    (navigation.navigate as (name: string, params?: object) => void)(tab, { screen: homeScreen });
  }
}
