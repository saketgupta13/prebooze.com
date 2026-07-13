import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';

const NAV = [
  { to: '/organizer', label: '▦ Dashboard', end: true },
  { to: '/organizer/events', label: '🎫 Events' },
  { to: '/organizer/attendees', label: '👥 Attendees' },
  { to: '/organizer/scanner', label: '📷 Scanner' },
  { to: '/organizer/guestlist', label: '📋 Guest list' },
  { to: '/organizer/live', label: '● Live monitor' },
  { to: '/organizer/reviews', label: '★ Reviews' },
  { to: '/organizer/coupons', label: '🏷 Coupons' },
  { to: '/organizer/carts', label: '🛒 Abandoned carts' },
  { to: '/organizer/payouts', label: '💰 Payouts' },
  { to: '/organizer/team', label: '🛡 Team & roles' },
  { to: '/organizer/settings', label: '⚙ Settings' },
];

export default function OrganizerLayout() {
  const { user, toastMsg } = useApp();

  if (!user) return <Navigate to="/login" state={{ from: '/organizer' }} replace />;
  if (!user.isOrganizer) return <Navigate to="/organizer/onboarding" replace />;

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
      {toastMsg && (
        <div
          style={{
            position: 'fixed',
            bottom: 24,
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'var(--accent)',
            color: 'var(--on-accent)',
            padding: '10px 18px',
            borderRadius: 999,
            fontWeight: 700,
            fontSize: 13,
            zIndex: 60,
            maxWidth: '90vw',
          }}
        >
          {toastMsg}
        </div>
      )}
    </main>
  );
}
