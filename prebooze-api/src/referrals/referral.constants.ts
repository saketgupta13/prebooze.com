import type { PrismaService } from '../prisma.service';

/** Shared with bookings.service.ts (which credits the referrer on the
 * referee's first paid booking) — keep both amounts here so they can't drift. */
export const REFERRAL_REFEREE_WELCOME = 100; // ₹ — credited to the referee at claim time
export const REFERRAL_REFERRER_REWARD = 100; // ₹ — credited to the referrer on the referee's first paid booking

/** Deterministic per-phone referral code — matches prebooze-web's referralCodeFor().
 * Only the last 8 digits feed the hash, so two phone numbers that share
 * those digits (e.g. the same local number under a different country code)
 * collide on the exact same code. Never call this directly at user-creation
 * time — User.referralCode is @unique, so a collision throws a raw Prisma
 * P2002 and the signup/booking/customer-creation call it's part of fails
 * outright. Use uniqueReferralCodeFor below instead. */
export function referralCodeFor(phone: string): string {
  const digits = phone.replace(/\D/g, '').slice(-8) || '0';
  return 'PB' + parseInt(digits, 10).toString(36).toUpperCase();
}

/** Collision-safe wrapper — same "-N" suffix loop AuthService.uniqueUsername
 * already uses for usernames, just against User.referralCode instead. Keeps
 * referralCodeFor's short, guessable-but-shareable codes for the common
 * case and only falls back to a longer code on an actual collision. */
export async function uniqueReferralCodeFor(prisma: PrismaService, phone: string): Promise<string> {
  const base = referralCodeFor(phone);
  let candidate = base;
  let n = 1;
  while (await prisma.user.findUnique({ where: { referralCode: candidate } })) {
    candidate = `${base}-${++n}`;
  }
  return candidate;
}
