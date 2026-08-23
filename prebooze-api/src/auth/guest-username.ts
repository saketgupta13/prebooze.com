/** Minimal shape both PrismaService and a $transaction's tx client satisfy —
 * this runs inside bookings.service.ts's checkout transaction as well as
 * AuthService's plain (non-tx) calls, so it can't require the concrete
 * PrismaService type. */
interface UserLookup {
  user: { findFirst: (args: { where: { username: string; id: { not: string } } } ) => Promise<unknown> };
}

/** Same slug convention KycService.newOrganizerRow/newPromoterRow/newLineupRow
 * already use for role usernames — lowercase, non-alphanumeric collapsed to a
 * single dash, trimmed. Guests get a real name-based username the moment a
 * name is known; see PLACEHOLDER_USERNAME below for what they carry before
 * that (name is never available yet at OTP-verify signup time). */
export function usernameFromName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '') || 'guest'
  );
}

/** Matches exactly what AuthService.uniqueUsername (phone-digit placeholder)
 * produces — never matches a username a guest typed themselves in
 * finish-profile/settings. Callers use this to decide whether it's safe to
 * silently swap in a name-based username once a name becomes known, without
 * ever clobbering a guest's own deliberate choice. */
export const PLACEHOLDER_USERNAME = /^guest\d+(-\d+)?$/;

/** Collision-safe wrapper — same "-N" suffix loop uniqueReferralCodeFor
 * already uses for referral codes, against User.username instead. */
export async function uniqueUsernameFromName(prisma: UserLookup, name: string, excludeUserId: string): Promise<string> {
  const base = usernameFromName(name);
  let candidate = base;
  let n = 1;
  while (await prisma.user.findFirst({ where: { username: candidate, id: { not: excludeUserId } } })) {
    candidate = `${base}-${++n}`;
  }
  return candidate;
}
