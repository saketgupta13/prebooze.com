import * as Haptics from 'expo-haptics';

/** Best-effort haptic feedback at key moments — a failure here (unsupported
 * device, simulator) must never affect the real action around it, same
 * fire-and-forget contract as lib/analytics.ts. */
function fire(fn: () => Promise<void>): void {
  fn().catch(() => {});
}

export const haptics = {
  /** Booking confirmed, follow toggled on, wishlist added — a positive
   * confirmation of something succeeding. */
  success: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  /** A request failed (follow/unfollow, payment, etc). */
  error: () => fire(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
  /** Lightweight tap feedback — toggles, chip selection, swipe actions. */
  tap: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Heavier confirmation — QR ticket scanned/validated at the door. */
  scan: () => fire(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
};
