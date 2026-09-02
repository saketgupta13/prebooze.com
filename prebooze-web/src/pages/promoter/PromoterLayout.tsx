import { useState } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PendingReview, { RejectedReview } from '../../components/PendingReview';
import { LayoutGrid, Megaphone, Globe, Banknote, Users, Trophy, CreditCard, Settings, MoreHorizontal, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/promoter', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/promoter/promotions', label: 'My promotions', icon: Megaphone },
  { to: '/promoter/city-events', label: 'Promote any event', icon: Globe },
  { to: '/promoter/earnings', label: 'Earnings', icon: Banknote },
  { to: '/promoter/team', label: 'Team', icon: Users },
  { to: '/promoter/leaderboard', label: 'Leaderboard', icon: Trophy },
  { to: '/promoter/subscription', label: 'Subscription', icon: CreditCard },
  { to: '/promoter/settings', label: 'Profile & settings', icon: Settings },
];

const PINNED_COUNT = 4;

export default function PromoterLayout() {
  const { user } = useApp();

  if (!user) return <Navigate to="/login" state={{ from: '/promoter' }} replace />;
  if (!user.isPromoter) {
    if (user.pendingRole === 'promoter' && user.roleStatus === 'pending') return <PendingReview role="promoter" />;
    if (user.pendingRole === 'promoter' && user.roleStatus === 'rejected') return <RejectedReview role="promoter" reason={user.roleRejectionReason} />;
    return <Navigate to="/promoter/onboarding" replace />;
  }

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side org-side-desktop-only">
          <div className="cap">PROMOTER</div>
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

/** Mobile-only bottom tab bar + "More" drawer — same shape as
 * VenueOrgLayout/OrganizerLayout's own MobileOrgNav (see those for the full
 * rationale: mirrors prebooze-admin's real Drawer, not a bottom sheet).
 * Duplicated per-console rather than shared, same precedent. */
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
              <span onClick={() => setOpen(false)} style={{ cursor: 'pointer', color: 'var(--muted)', display: 'flex', lineHeight: 1 }}><X size={18} /></span>
            </div>
            {rest.map((n) => (
              <NavLink key={n.to} to={n.to} end={n.end} onClick={() => setOpen(false)} className={({ isActive }) => (isActive ? 'on' : '')}>
                {n.label}
              </NavLink>
            ))}
          </div>
        </>
      )}
    </>
  );
}
