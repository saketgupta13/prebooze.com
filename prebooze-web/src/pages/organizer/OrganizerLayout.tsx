import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';

const NAV = [
  { to: '/organizer', label: '▦ Dashboard', end: true },
  { to: '/organizer/events', label: '🎫 Events' },
  { to: '/organizer/attendees', label: '👥 Attendees' },
  { to: '/organizer/coupons', label: '🏷 Coupons' },
  { to: '/organizer/payouts', label: '💰 Payouts' },
  { to: '/organizer/settings', label: '⚙ Settings' },
];

export default function OrganizerLayout() {
  const { user } = useApp();

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
    </main>
  );
}
