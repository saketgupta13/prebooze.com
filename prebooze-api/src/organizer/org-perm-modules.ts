// Split out from org-team.service.ts (2026-09-24) purely to break a
// circular import: org-access.service.ts needs backfillPermissions() for
// enforcement, and org-team.service.ts already imports OrgAccessService —
// a plain-object/function-only file with no NestJS providers is safe for
// both to import without a circular-DI failure at boot (NestJS's CommonJS
// module loading resolved OrgAccessService as undefined when the two
// service files imported each other directly, throwing
// UndefinedDependencyException on startup).
//
// Expanded 2026-09-24 from the original 7 broad buckets — organizer
// feedback was that the groupings themselves were confusing (e.g.
// Abandoned carts was silently bundled under "Events & wizard", so a role
// with events access blocked also lost cart-recovery access with no way
// to grant one without the other; Promoters was silently bundled under
// "Payouts & withdrawals", same problem). Each split below maps to a real,
// separate screen a role either does or doesn't need — see SPLIT_SOURCE
// for exactly which old bucket each new module's default value carries
// forward from, and backfillPermissions() for how an already-saved role
// (using the old 7 keys) picks up the new keys without any access
// silently changing.
export const ORG_PERM_MODULES = [
  'Dashboard',
  'Events & wizard',
  'Abandoned carts',
  'Attendees & check-in',
  'Guest list',
  'Coupons',
  'Payouts & withdrawals',
  'Promoters',
  'Reviews',
  'Settings',
  'Team & roles',
] as const;

export type PermSet = { view: boolean; edit: boolean };
export type PermMatrix = Record<string, PermSet>;

export const perms = (view: boolean, edit: boolean): PermSet => ({ view, edit });

// Where a newly-split module's value comes from when backfilling an
// already-saved role (or defining DEFAULT_ROLES) — mechanical
// carry-forward only, deliberately not a re-judgment of what any
// existing role should be allowed to do (that's for each organizer to
// decide themselves in the now-expanded Team & roles editor).
const SPLIT_SOURCE: Record<string, string> = {
  'Abandoned carts': 'Events & wizard',
  Promoters: 'Payouts & withdrawals',
  Settings: 'Settings & team',
  'Team & roles': 'Settings & team',
};

/** Fills in any module key missing from a saved (possibly pre-expansion)
 * permissions matrix — a role saved under the old 7-key shape reads as
 * having a real, carried-forward value for every new module instead of
 * silently losing access to whatever ORG_PERM_MODULES adds next. Dashboard
 * has no old-bucket source (it's new product surface, not a split) and
 * defaults to view-only for everyone, matching today's actual behaviour
 * (RN's Dashboard tab has never been permission-gated). Pure function —
 * callers decide whether/when to persist the result. */
export function backfillPermissions(permissions: PermMatrix): { matrix: PermMatrix; changed: boolean } {
  let changed = false;
  const matrix: PermMatrix = { ...permissions };
  for (const m of ORG_PERM_MODULES) {
    if (matrix[m]) continue;
    changed = true;
    const source = SPLIT_SOURCE[m];
    matrix[m] = source && matrix[source] ? { ...matrix[source] } : m === 'Dashboard' ? perms(true, false) : perms(false, false);
  }
  return { matrix, changed };
}
