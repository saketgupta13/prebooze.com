import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PendingReview, { RejectedReview } from '../../components/PendingReview';

// `module` is the exact OrgRole permission-matrix key that gates this nav
// item's visibility for an invited team member (see OrgTeamRoles.tsx's
// PERM_MODULES / the backend's ORG_PERM_MODULES — must match exactly).
// `undefined` = always visible to any team member regardless of role
// (Dashboard); `'owner'` = never shown to a team member at all, real
// account owner only (Billing — money/KYC, not delegated via any role).
const NAV: { to: string; label: string; end?: boolean; module?: string | 'owner' }[] = [
  { to: '/organizer', label: '▦ Dashboard', end: true },
  { to: '/organizer/events', label: '🎫 Events', module: 'Events & wizard' },
  { to: '/organizer/attendees', label: '👥 Attendees', module: 'Attendees & check-in' },
  { to: '/organizer/scanner', label: '📷 Scanner', module: 'Attendees & check-in' },
  { to: '/organizer/guestlist', label: '📋 Guest list', module: 'Guest list' },
  { to: '/organizer/live', label: '● Live monitor', module: 'Attendees & check-in' },
  { to: '/organizer/reviews', label: '★ Reviews', module: 'Reviews' },
  { to: '/organizer/coupons', label: '🏷 Promo codes', module: 'Coupons' },
  { to: '/organizer/carts', label: '🛒 Abandoned carts', module: 'Events & wizard' },
  { to: '/organizer/payouts', label: '💰 Payouts', module: 'Payouts & withdrawals' },
  { to: '/organizer/team', label: '🛡 Team & roles', module: 'Settings & team' },
  { to: '/organizer/billing', label: '⭐ Featured & billing', module: 'owner' },
  { to: '/organizer/settings', label: '⚙ Settings', module: 'Settings & team' },
];

export default function OrganizerLayout() {
  const { user, orgTeamAccess, orgTeamAccessLoaded } = useApp();

  if (!user) return <Navigate to="/login" state={{ from: '/organizer' }} replace />;
  if (!user.isOrganizer) {
    // A real invited team member — not the KYC-approved owner, but a
    // legitimate scoped console access grant (see OrgTeamService.addStaff /
    // OrgAccessService). Falls through to the console below instead of the
    // onboarding/pending-review screens, which are for the owner path only.
    if (orgTeamAccess) return <TeamConsole access={orgTeamAccess} />;
    // orgTeamAccess resolves async (a fetch, not known at first render) —
    // must wait for it before concluding "not staff anywhere" and bouncing
    // to onboarding, or a team member's console flashes/redirects wrong on
    // every load.
    if (!orgTeamAccessLoaded) return <div className="page container muted">Loading…</div>;
    if (user.pendingRole === 'organizer' && user.roleStatus === 'pending') return <PendingReview role="organizer" />;
    if (user.pendingRole === 'organizer' && user.roleStatus === 'rejected') return <RejectedReview role="organizer" reason={user.roleRejectionReason} />;
    return <Navigate to="/organizer/onboarding" replace />;
  }

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side">
          <div className="cap">ORGANIZER</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
              {n.label}
            </NavLink>
          ))}
        </aside>
        <div style={{ minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
    </main>
  );
}

function TeamConsole({ access }: { access: NonNullable<ReturnType<typeof useApp>['orgTeamAccess']> }) {
  const canView = (module?: string | 'owner') => module === undefined || (module !== 'owner' && !!access.permissions[module]?.view);
  const visibleNav = NAV.filter((n) => canView(n.module));

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side">
          <div className="cap">ORGANIZER</div>
          <div className="tiny muted" style={{ padding: '0 4px 10px', lineHeight: 1.5 }}>
            Managing <b>{access.organizerBrand}</b> as <b>{access.roleName}</b>
          </div>
          {visibleNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
              {n.label}
            </NavLink>
          ))}
        </aside>
        <div style={{ minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
    </main>
  );
}
