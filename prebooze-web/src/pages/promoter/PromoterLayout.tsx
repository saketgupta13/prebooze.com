import { useState } from 'react';
import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PendingReview, { RejectedReview } from '../../components/PendingReview';

const NAV = [
  { to: '/promoter', label: '▦ Dashboard', end: true },
  { to: '/promoter/promotions', label: '📣 My promotions' },
  { to: '/promoter/earnings', label: '💰 Earnings' },
  { to: '/promoter/team', label: '👥 Team' },
  { to: '/promoter/leaderboard', label: '🏆 Leaderboard' },
  { to: '/promoter/subscription', label: '💳 Subscription' },
  { to: '/promoter/settings', label: '⚙ Profile & settings' },
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
              {n.label}
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
        {pinned.map((n) => {
          const [ico, ...labelParts] = n.label.split(' ');
          return (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
              <span className="ico">{ico}</span>
              {labelParts.join(' ')}
            </NavLink>
          );
        })}
        {rest.length > 0 && (
          <button onClick={() => setOpen(true)}>
            <span className="ico">⋯</span>
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
              <span onClick={() => setOpen(false)} style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 18, lineHeight: 1 }}>✕</span>
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
