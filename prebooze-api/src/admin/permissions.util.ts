// Mirrors prebooze-admin's src/lib/liveApi.ts PERM_MODULES exactly.
export const PERM_MODULES = [
  'Dashboard',
  'Events & approvals',
  'Event commission (per event)',
  'Bookings',
  'Refunds',
  'Payments & payouts',
  'Customers',
  'Organizers',
  'Promoters',
  'Lineups',
  'Venues',
  'Verifications (KYC)',
  'Reviews',
  'Locations',
  'Abandoned carts',
  'Featured',
  'Content',
  'Careers',
  'Reels',
  'Promo codes',
  'Gate check-in',
  'Reports',
  'Leads',
] as const;

export interface PermSet {
  view: boolean;
  edit: boolean;
  approve: boolean;
}

const FULL: PermSet = { view: true, edit: true, approve: true };
const NONE: PermSet = { view: false, edit: false, approve: false };

/** The single source of truth for "what can this role actually do" —
 * StaffRole.permissions is only ever explicit for whatever PERM_MODULES
 * existed when the role was last created/edited, so a module added after
 * that point is simply missing from the stored JSON, not "set to false".
 * This resolves every current PERM_MODULES entry to a real PermSet: the
 * stored value when one exists, otherwise role.defaultOpen's fallback
 * (full access for "broad" roles like Owner/Manager, no access for
 * narrow hand-picked roles). Used by both PermissionGuard (enforcement)
 * and StaffAuthService.toApiStaff (what the admin frontend's nav/role
 * editor actually see) — one implementation, so they can't drift the way
 * they did before this existed. */
export function resolvePermissions(role: { permissions: unknown; defaultOpen: boolean }): Record<string, PermSet> {
  const stored = (role.permissions as Record<string, PermSet>) ?? {};
  const fallback = role.defaultOpen ? FULL : NONE;
  return Object.fromEntries(PERM_MODULES.map((m) => [m, stored[m] ?? fallback]));
}
