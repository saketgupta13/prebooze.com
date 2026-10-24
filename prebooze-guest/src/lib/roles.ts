import type { User } from '../types';

export type ElevatedRole = 'organizer' | 'promoter' | 'lineup' | 'venue';

const LABELS: Record<ElevatedRole, string> = { organizer: 'Organizer', promoter: 'Promoter', lineup: 'Line-up artist', venue: 'Venue partner' };
export const roleLabel = (r: ElevatedRole) => LABELS[r];

/** The single elevated role this phone number already holds, if any —
 * ports prebooze-web/src/lib/roles.ts's existingRole() (minus the
 * pending-application branch, not tracked on the guest app's trimmed
 * User type). A guest-app login can still belong to an organizer/
 * promoter/lineup/venue phone number, and that account can't book
 * tickets as a guest. */
export function existingRole(user: User | null): ElevatedRole | null {
  if (user?.isOrganizer) return 'organizer';
  if (user?.isPromoter) return 'promoter';
  if (user?.isLineup) return 'lineup';
  if (user?.isVenue) return 'venue';
  return null;
}
