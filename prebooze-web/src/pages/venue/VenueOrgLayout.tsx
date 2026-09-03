import { useEffect, useState } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PendingReview, { RejectedReview } from '../../components/PendingReview';
import { PageLoader } from '../../components/Loader';
import { venuePartner } from '../../api';
import {
  LayoutDashboard, Ticket, Users, QrCode, ClipboardList, Activity, Percent, ShoppingCart, Banknote, Megaphone, Shield, Settings, MoreHorizontal, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

// `module` is the exact VenueRole permission-matrix key that gates this nav
// item's visibility for an invited team member (see VenueTeamRoles.tsx's
// PERM_MODULES / the backend's VENUE_ORG_PERM_MODULES — must match exactly).
// Same shape as OrganizerLayout's NAV, minus Team & roles duplication logic
// and minus Reviews (kept solely on the venue panel — see VenueReviews.tsx).
const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean; module?: string }[] = [
  { to: '/venue/hosting', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/venue/hosting/events', label: 'Events', icon: Ticket, module: 'Events & wizard' },
  { to: '/venue/hosting/bookings', label: 'Bookings', icon: Users, module: 'Attendees & check-in' },
  { to: '/venue/hosting/scanner', label: 'Scanner', icon: QrCode, module: 'Attendees & check-in' },
  { to: '/venue/hosting/guest-list', label: 'Guest list', icon: ClipboardList, module: 'Guest list' },
  { to: '/venue/hosting/live', label: 'Live monitor', icon: Activity, module: 'Attendees & check-in' },
  { to: '/venue/hosting/coupons', label: 'Promo codes', icon: Percent, module: 'Coupons' },
  { to: '/venue/hosting/carts', label: 'Abandoned carts', icon: ShoppingCart, module: 'Events & wizard' },
  { to: '/venue/hosting/ledger', label: 'Payouts', icon: Banknote, module: 'Payouts & withdrawals' },
  { to: '/venue/hosting/promoters', label: 'Promoters', icon: Megaphone, module: 'Payouts & withdrawals' },
  { to: '/venue/hosting/team', label: 'Team & roles', icon: Shield, module: 'Settings & team' },
  { to: '/venue/hosting/settings', label: 'Settings', icon: Settings, module: 'Settings & team' },
];

// How many of navItems (in NAV order) get a permanent bottom-tab slot on
// mobile — the rest live in the "More" drawer. Whatever a given viewer can
// actually see (owner: everything; staff: their permission-filtered list)
// naturally fills these first, so this never hardcodes a route a staff
// member might not have access to.
const PINNED_COUNT = 4;

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
        <aside className="org-side org-side-desktop-only">
          <div className="cap">ORGANIZER</div>
          {hostingEnabled ? (
            NAV.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <n.icon size={15} /> {n.label}
              </NavLink>
            ))
          ) : (
            <div className="tiny muted-2" style={{ padding: '6px 4px' }}>
              Request to host events to unlock this panel.
            </div>
          )}
        </aside>
        <div className={hostingEnabled ? 'org-mobile-content' : undefined} style={{ minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
      {hostingEnabled && <MobileOrgNav navItems={NAV} />}
    </main>
  );
}

function TeamConsole({ access }: { access: NonNullable<ReturnType<typeof useApp>['venueTeamAccess']> }) {
  const canView = (module?: string) => module === undefined || !!access.permissions[module]?.view;
  const visibleNav = NAV.filter((n) => canView(n.module));

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side org-side-desktop-only">
          <div className="cap">ORGANIZER</div>
          <div className="tiny muted" style={{ padding: '0 4px 10px', lineHeight: 1.5 }}>
            Managing <b>{access.venueBrand}</b> as <b>{access.roleName}</b>
          </div>
          {visibleNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <n.icon size={15} /> {n.label}
            </NavLink>
          ))}
        </aside>
        <div className="org-mobile-content" style={{ minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
      <MobileOrgNav navItems={visibleNav} />
    </main>
  );
}

/** Mobile-only bottom tab bar + "More" drawer — hidden entirely on desktop
 * (CSS, see .org-mobile-tabbar), where the real .org-side sidebar above
 * already shows everything. The drawer is a fixed-width right-side panel
 * with a dimmed scrim behind it (same shape as prebooze-admin's own
 * Drawer/MoreMenu), not a bottom sheet that covers the screen. */
function MobileOrgNav({ navItems }: { navItems: typeof NAV }) {
  const [open, setOpen] = useState(false);
  const pinned = navItems.slice(0, PINNED_COUNT);
  const rest = navItems.slice(PINNED_COUNT);

  return (
    <>
      <nav className="org-mobile-tabbar">
        {pinned.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
            <span className="ico"><n.icon size={18} /></span>
            {n.label}
          </NavLink>
        ))}
        {rest.length > 0 && (
          <button onClick={() => setOpen(true)}>
            <span className="ico"><MoreHorizontal size={18} /></span>
            More
          </button>
        )}
      </nav>
      {open && (
        <>
          <div className="org-drawer-overlay" onClick={() => setOpen(false)} />
          <div className="org-drawer">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span className="cap" style={{ padding: 0 }}>MORE</span>
              <span onClick={() => setOpen(false)} style={{ cursor: 'pointer', color: 'var(--muted)', display: 'flex' }}><X size={18} /></span>
            </div>
            {rest.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'on' : '')} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <n.icon size={15} /> {n.label}
              </NavLink>
            ))}
          </div>
        </>
      )}
    </>
  );
}
