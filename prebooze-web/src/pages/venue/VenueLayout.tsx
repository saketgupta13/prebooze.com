import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';

const NAV = [
  { to: '/venue', label: '▦ Dashboard', end: true },
  { to: '/venue/listing', label: '🏛 My listing' },
  { to: '/venue/events', label: '📅 Events here' },
  { to: '/venue/settings', label: '⚙ Settings' },
];

export default function VenueLayout() {
  const { user, toastMsg } = useApp();

  if (!user) return <Navigate to="/login" state={{ from: '/venue' }} replace />;
  if (!user.isVenue) return <Navigate to="/venue/onboarding" replace />;

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side">
          <div className="cap">VENUE</div>
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
