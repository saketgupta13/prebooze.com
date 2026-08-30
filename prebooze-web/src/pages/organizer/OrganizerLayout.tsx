import { useState } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PendingReview, { RejectedReview } from '../../components/PendingReview';
import { PageLoader } from '../../components/Loader';
import {
  LayoutDashboard, Ticket, Users, Camera, ClipboardList, Radio, Star, Tag, ShoppingCart, Banknote, Megaphone,
  ShieldCheck, Award, Settings as SettingsIcon, MoreHorizontal, X, type LucideIcon,
} from 'lucide-react';

// `module` is the exact OrgRole permission-matrix key that gates this nav
// item's visibility for an invited team member (see OrgTeamRoles.tsx's
// PERM_MODULES / the backend's ORG_PERM_MODULES — must match exactly).
// `undefined` = always visible to any team member regardless of role
// (Dashboard); `'owner'` = never shown to a team member at all, real
// account owner only (Billing — money/KYC, not delegated via any role).
const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean; module?: string | 'owner' }[] = [
  { to: '/organizer', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/organizer/events', label: 'Events', icon: Ticket, module: 'Events & wizard' },
  { to: '/organizer/attendees', label: 'Attendees', icon: Users, module: 'Attendees & check-in' },
  { to: '/organizer/scanner', label: 'Scanner', icon: Camera, module: 'Attendees & check-in' },
  { to: '/organizer/guestlist', label: 'Guest list', icon: ClipboardList, module: 'Guest list' },
  { to: '/organizer/live', label: 'Live monitor', icon: Radio, module: 'Attendees & check-in' },
  { to: '/organizer/reviews', label: 'Reviews', icon: Star, module: 'Reviews' },
  { to: '/organizer/coupons', label: 'Promo codes', icon: Tag, module: 'Coupons' },
  { to: '/organizer/carts', label: 'Abandoned carts', icon: ShoppingCart, module: 'Events & wizard' },
  { to: '/organizer/payouts', label: 'Payouts', icon: Banknote, module: 'Payouts & withdrawals' },
  { to: '/organizer/promoters', label: 'Promoters', icon: Megaphone, module: 'Payouts & withdrawals' },
  { to: '/organizer/team', label: 'Team & roles', icon: ShieldCheck, module: 'Settings & team' },
  { to: '/organizer/billing', label: 'Featured & billing', icon: Award, module: 'owner' },
  { to: '/organizer/settings', label: 'Settings', icon: SettingsIcon, module: 'Settings & team' },
];

// How many of navItems (in NAV order) get a permanent bottom-tab slot on
// mobile — the rest live in the "More" drawer. Same shape as
// VenueOrgLayout's MobileOrgNav (14 items here has the identical
// too-long-for-.org-side problem venue's 12 did).
const PINNED_COUNT = 4;

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
    if (!orgTeamAccessLoaded) return <PageLoader />;
    if (user.pendingRole === 'organizer' && user.roleStatus === 'pending') return <PendingReview role="organizer" />;
    if (user.pendingRole === 'organizer' && user.roleStatus === 'rejected') return <RejectedReview role="organizer" reason={user.roleRejectionReason} />;
    return <Navigate to="/organizer/onboarding" replace />;
  }

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side org-side-desktop-only">
          <div className="cap">ORGANIZER</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
              <n.icon size={16} /> {n.label}
            </NavLink>
          ))}
        </aside>
        <div className="org-mobile-content" style={{ minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
      <MobileOrgNav navItems={NAV} />
    </main>
  );
}

function TeamConsole({ access }: { access: NonNullable<ReturnType<typeof useApp>['orgTeamAccess']> }) {
  const canView = (module?: string | 'owner') => module === undefined || (module !== 'owner' && !!access.permissions[module]?.view);
  const visibleNav = NAV.filter((n) => canView(n.module));

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side org-side-desktop-only">
          <div className="cap">ORGANIZER</div>
          <div className="tiny muted" style={{ padding: '0 4px 10px', lineHeight: 1.5 }}>
            Managing <b>{access.organizerBrand}</b> as <b>{access.roleName}</b>
          </div>
          {visibleNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
              <n.icon size={16} /> {n.label}
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
 * Drawer/MoreMenu), not a bottom sheet that covers the screen. Duplicated
 * from VenueOrgLayout's own MobileOrgNav rather than shared — same
 * "mirror, don't share" precedent as this codebase's other console pairs. */
function MobileOrgNav({ navItems }: { navItems: typeof NAV }) {
  const [open, setOpen] = useState(false);
  const pinned = navItems.slice(0, PINNED_COUNT);
  const rest = navItems.slice(PINNED_COUNT);

  return (
    <>
      <nav className="org-mobile-tabbar">
        {pinned.map((n) => (
          <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
            <span className="ico"><n.icon size={16} /></span>
            {n.label}
          </NavLink>
        ))}
        {rest.length > 0 && (
          <button onClick={() => setOpen(true)}>
            <span className="ico"><MoreHorizontal size={16} /></span>
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
              <span onClick={() => setOpen(false)} style={{ cursor: 'pointer', color: 'var(--muted)', display: 'flex', alignItems: 'center' }}><X size={18} /></span>
            </div>
            {rest.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'on' : '')}>
                <n.icon size={16} /> {n.label}
              </NavLink>
            ))}
          </div>
        </>
      )}
    </>
  );
}
