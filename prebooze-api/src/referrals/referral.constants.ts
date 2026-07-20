/** Shared with bookings.service.ts (which credits the referrer on the
 * referee's first paid booking) — keep both amounts here so they can't drift. */
export const REFERRAL_REFEREE_WELCOME = 100; // ₹ — credited to the referee at claim time
export const REFERRAL_REFERRER_REWARD = 100; // ₹ — credited to the referrer on the referee's first paid booking

/** Deterministic per-phone referral code — matches prebooze-web's referralCodeFor(). */
export function referralCodeFor(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-8) || '0';
  return 'PB' + parseInt(digits, 10).toString(36).toUpperCase();
}
