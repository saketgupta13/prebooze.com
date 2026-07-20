import type { User } from '../types';

export type Role = 'organizer' | 'promoter' | 'lineup' | 'venue';

const LABELS: Record<Role, string> = { organizer: 'organizer', promoter: 'promoter', lineup: 'line-up artist', venue: 'venue partner' };
export const roleLabel = (r: Role) => LABELS[r];
export const roleHome: Record<Role, string> = { organizer: '/organizer', promoter: '/promoter', lineup: '/profile', venue: '/venue' };
export const roleOnboardingPath: Record<Role, string> = {
  organizer: '/organizer/onboarding',
  promoter: '/promoter/onboarding',
  lineup: '/lineup/onboarding',
  venue: '/venue/onboarding',
};

/** The single elevated role this number already holds (approved), if any.
 * One number = one role — this also blocks a second role's onboarding. */
export function existingRole(user: User | null): Role | null {
  if (user?.isOrganizer) return 'organizer';
  if (user?.isPromoter) return 'promoter';
  if (user?.isLineup) return 'lineup';
  if (user?.isVenue) return 'venue';
  // a pending application also occupies the number's one role slot —
  // otherwise someone could apply for two roles at once while both sit in review
  if (user?.roleStatus === 'pending' && user.pendingRole) return user.pendingRole;
  return null;
}

/** True while a submitted role application is waiting on manual review by the team. */
export function isPendingReview(user: User | null, role: Role): boolean {
  return user?.roleStatus === 'pending' && user?.pendingRole === role;
}
