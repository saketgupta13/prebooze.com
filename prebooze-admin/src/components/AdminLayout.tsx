import { Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { GUEST_SITE_URL } from '../store/data';

const MAIN_NAV = [
  { to: '/', icon: '▦', label: 'Dashboard', end: true },
  { to: '/events', icon: '🎪', label: 'Events' },
  { to: '/bookings', icon: '🎟', label: 'Bookings' },
  { to: '/customers', icon: '👥', label: 'Customers' },
  { to: '/organizers', icon: '🧑‍💼', label: 'Organizers' },
  { to: '/venues', icon: '📍', label: 'Venues' },
  { to: '/payments', icon: '💰', label: 'Payments' },
  { to: '/promos', icon: '🏷', label: 'Promo codes' },
  { to: '/reports', icon: '📈', label: 'Reports' },
];

const CONTENT_NAV = [
  { to: '/banners', icon: '🖼', label: 'Banners' },
  { to: '/categories', icon: '🗂', label: 'Categories' },
  { to: '/blogs', icon: '✍', label: 'Blogs' },
  { to: '/pages', icon: '📄', label: 'Pages' },
];

const MOBILE_NAV = [
  { to: '/', icon: '▦', label: 'Home', end: true },
  { to: '/events', icon: '🎪', label: 'Events' },
  { to: '/bookings', icon: '🎟', label: 'Bookings' },
  { to: '/payments', icon: '💰', label: 'Money' },
  { to: '/promos', icon: '⋯', label: 'More' },
];

export default function AdminLayout() {
  const { session, logout, toast } = useAdmin();
  const navigate = useNavigate();

  if (!session) return <Navigate to="/login" replace />;

  return (
    <>
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src="/logo.png" alt="Prebooze" />
          <span className="role-tag">{session.role === 'staff' ? 'STAFF' : 'ADMIN'}</span>
        </div>
        <div className="search-box hide-mobile" style={{ flex: 1, maxWidth: 420 }}>
          <span style={{ opacity: 0.6 }}>🔍</span>
          <input
            placeholder="Search bookings, events, users…"
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                navigate('/bookings');
              }
            }}
          />
        </div>
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm hide-mobile" onClick={() => toast('3 unread notifications')}>
          🔔 3
        </button>
        <a href={GUEST_SITE_URL} target="_blank" rel="noreferrer" className="btn btn-pri btn-sm">
          View guest site →
        </a>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            logout();
            navigate('/login');
          }}
        >
          Log out
        </button>
        <div className="avatar">👤</div>
      </header>

      <div className="shell">
        <nav className="sidebar">
          {MAIN_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
          <div className="group">Content</div>
          {CONTENT_NAV.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
          <div style={{ flex: 1 }} />
          <NavLink to="/staff" className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
            <span>🛡</span>
            <span>Staff &amp; roles</span>
          </NavLink>
        </nav>

        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="bottomnav">
        {MOBILE_NAV.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.end}
            className={({ isActive }) => (isActive ? 'on' : '')}
            style={({ isActive }) => ({
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              fontSize: 10,
              fontWeight: isActive ? 700 : 500,
              color: isActive ? 'var(--green)' : 'var(--muted)',
            })}
          >
            <span className="ico" style={{ fontSize: 15 }}>{n.icon}</span>
            {n.label}
          </NavLink>
        ))}
      </nav>

      <ToastHost />
    </>
  );
}

export function ToastHost() {
  const { toastMsg } = useAdmin();
  if (!toastMsg) return null;
  return <div className="toast">{toastMsg}</div>;
}
