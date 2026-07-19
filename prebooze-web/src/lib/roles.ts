import type { User } from '../types';

export type Role = 'organizer' | 'promoter' | 'lineup' | 'venue';

const LABELS: Record<Role, string> = { organizer: 'organizer', promoter: 'promoter', lineup: 'line-up artist', venue: 'venue partner' };
export const roleLabel = (r: Role) => LABELS[r];
export const roleHome: Record<Role, string> = { organizer: '/organizer', promoter: '/promoter', lineup: '/profile', venue: '/venue' };

/** The single elevated role this number already holds, if any. One number = one role. */
export function existingRole(user: User | null): Role | null {
  if (user?.isOrganizer) return 'organizer';
  if (user?.isPromoter) return 'promoter';
  if (user?.isLineup) return 'lineup';
  if (user?.isVenue) return 'venue';
  return null;
}
