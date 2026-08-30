import { useState } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PendingReview, { RejectedReview } from '../../components/PendingReview';
import { LayoutGrid, Settings, Star, MoreHorizontal, X } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

const NAV: { to: string; label: string; icon: LucideIcon; end?: boolean }[] = [
  { to: '/artist', label: 'Dashboard', icon: LayoutGrid, end: true },
  { to: '/artist/profile', label: 'Profile & settings', icon: Settings },
  { to: '/artist/billing', label: 'Featured & billing', icon: Star },
];

const PINNED_COUNT = 4;

export default function LineupLayout() {
  const { user } = useApp();

  if (!user) return <Navigate to="/login" state={{ from: '/artist' }} replace />;
  if (!user.isLineup) {
    if (user.pendingRole === 'lineup' && user.roleStatus === 'pending') return <PendingReview role="lineup" />;
    if (user.pendingRole === 'lineup' && user.roleStatus === 'rejected') return <RejectedReview role="lineup" reason={user.roleRejectionReason} />;
    return <Navigate to="/lineup/onboarding" replace />;
  }

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side org-side-desktop-only">
          <div className="cap">LINE-UP</div>
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
 * With only 3 items total here, the "More" button naturally never renders
 * (nothing left over after pinning) — no special-casing needed. */
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
