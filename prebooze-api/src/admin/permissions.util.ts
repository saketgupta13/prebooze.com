// Mirrors prebooze-admin's src/lib/liveApi.ts PERM_MODULES exactly.
export const PERM_MODULES = [
  'Dashboard',
  'Events & approvals',
  'Event commission (per event)',
  'Bookings',
  'Refunds',
  'Payments & payouts',
  'Financial reports',
  'Invoices',
  'Transactions',
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
  'Marketing campaigns',
  'Content',
  'Careers',
  'Reels',
  'Promo codes',
  'Gate check-in',
  'Analytics',
  'Leads',
  'Support tickets',
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
  return Object.fromEntries(
    PERM_MODULES.map((m) => [
      m,
      // 'Analytics' used to be a real PERM_MODULES entry named 'Reports'
      // (renamed 2026-09-21 — it never gated anything else, the real
      // Reports/P&L page has always used 'Payments & payouts') — an
      // existing role's stored JSON still has the old key under 'Reports',
      // not 'Analytics', so this falls back to that exact old value before
      // falling all the way back to defaultOpen. Keeps every existing
      // role's Analytics access exactly what its Reports access already was.
      m === 'Analytics' ? (stored.Analytics ?? stored.Reports ?? fallback)
      // 'Financial reports' is new (2026-10-06) — split out of 'Payments &
      // payouts' because that module also gates real payout actions
      // (mark-paid, advancing a withdrawal), so a Finance role that only
      // needed to READ reports had no way to get that without also being
      // able to trigger real payouts. No existing role has this key stored
      // yet, so every one falls back to its own CURRENT 'Payments &
      // payouts' value (not just defaultOpen) — nobody who could already
      // see Reports loses that the moment this ships; an Owner/admin can
      // narrow it afterward per role if they want the split enforced.
      : m === 'Financial reports' ? (stored['Financial reports'] ?? stored['Payments & payouts'] ?? fallback)
      // 'Invoices' is new (2026-10-06), same split + same carryover
      // reasoning as 'Financial reports' immediately above.
      : m === 'Invoices' ? (stored.Invoices ?? stored['Payments & payouts'] ?? fallback)
      : (stored[m] ?? fallback),
    ]),
  );
}
