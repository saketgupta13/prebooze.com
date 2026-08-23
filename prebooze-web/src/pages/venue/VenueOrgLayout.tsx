import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PendingReview, { RejectedReview } from '../../components/PendingReview';
import { PageLoader } from '../../components/Loader';
import { venuePartner } from '../../api';

// `module` is the exact VenueRole permission-matrix key that gates this nav
// item's visibility for an invited team member (see VenueTeamRoles.tsx's
// PERM_MODULES / the backend's VENUE_ORG_PERM_MODULES — must match exactly).
// Same shape as OrganizerLayout's NAV, minus Team & roles duplication logic
// and minus Reviews (kept solely on the venue panel — see VenueReviews.tsx).
const NAV: { to: string; label: string; end?: boolean; module?: string }[] = [
  { to: '/venue/hosting', label: '▦ Dashboard', end: true },
  { to: '/venue/hosting/events', label: '🎫 Events', module: 'Events & wizard' },
  { to: '/venue/hosting/attendees', label: '👥 Attendees', module: 'Attendees & check-in' },
  { to: '/venue/hosting/scanner', label: '📷 Scanner', module: 'Attendees & check-in' },
  { to: '/venue/hosting/guest-list', label: '📋 Guest list', module: 'Guest list' },
  { to: '/venue/hosting/live', label: '● Live monitor', module: 'Attendees & check-in' },
  { to: '/venue/hosting/coupons', label: '🏷 Promo codes', module: 'Coupons' },
  { to: '/venue/hosting/carts', label: '🛒 Abandoned carts', module: 'Events & wizard' },
  { to: '/venue/hosting/ledger', label: '💰 Payouts', module: 'Payouts & withdrawals' },
  { to: '/venue/hosting/promoters', label: '📣 Promoters', module: 'Payouts & withdrawals' },
  { to: '/venue/hosting/team', label: '🛡 Team & roles', module: 'Settings & team' },
  { to: '/venue/hosting/settings', label: '⚙ Settings', module: 'Settings & team' },
];

export default function VenueOrgLayout() {
  const { user, venueTeamAccess, venueTeamAccessLoaded } = useApp();
  const [hostingEnabled, setHostingEnabled] = useState(false);
  const [statusLoaded, setStatusLoaded] = useState(false);

  useEffect(() => {
    if (user?.isVenue) {
      venuePartner.hostingStatus()
        .then((s) => setHostingEnabled(s.hostingEnabled))
        .catch(() => {})
        .finally(() => setStatusLoaded(true));
    } else {
      setStatusLoaded(true);
    }
  }, [user?.isVenue]);

  if (!user) return <Navigate to="/login" state={{ from: '/venue/hosting' }} replace />;
  if (!user.isVenue) {
    // A real invited hosting-team member — not the venue owner, but a
    // legitimate scoped console access grant (see VenueTeamService.addStaff
    // / VenueAccessService). Falls through to the filtered console below
    // instead of the venue onboarding/pending-review screens, which are
    // for the owner path only.
    if (venueTeamAccess) return <TeamConsole access={venueTeamAccess} />;
    if (!venueTeamAccessLoaded) return <PageLoader />;
    if (user.pendingRole === 'venue' && user.roleStatus === 'pending') return <PendingReview role="venue" />;
    if (user.pendingRole === 'venue' && user.roleStatus === 'rejected') return <RejectedReview role="venue" reason={user.roleRejectionReason} />;
    return <Navigate to="/venue/onboarding" replace />;
  }

  if (!statusLoaded) return <PageLoader />;

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side">
          <div className="cap">ORGANIZER</div>
          {hostingEnabled ? (
            NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
                {n.label}
              </NavLink>
            ))
          ) : (
            <div className="tiny muted-2" style={{ padding: '6px 4px' }}>
              Request to host events to unlock this panel.
            </div>
          )}
        </aside>
        <div style={{ minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
    </main>
  );
}

function TeamConsole({ access }: { access: NonNullable<ReturnType<typeof useApp>['venueTeamAccess']> }) {
  const canView = (module?: string) => module === undefined || !!access.permissions[module]?.view;
  const visibleNav = NAV.filter((n) => canView(n.module));

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side">
          <div className="cap">ORGANIZER</div>
          <div className="tiny muted" style={{ padding: '0 4px 10px', lineHeight: 1.5 }}>
            Managing <b>{access.venueBrand}</b> as <b>{access.roleName}</b>
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
