import { useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { GUEST_SITE_URL } from '../store/data';
import NotificationsPanel from './NotificationsPanel';

const MAIN_NAV = [
  { to: '/', icon: '▦', label: 'Dashboard', end: true },
  { to: '/events', icon: '🎪', label: 'Events' },
  { to: '/bookings', icon: '🎟', label: 'Bookings' },
  { to: '/abandoned', icon: '🛒', label: 'Abandoned carts' },
  { to: '/customers', icon: '👥', label: 'Customers' },
  { to: '/organizers', icon: '🧑‍💼', label: 'Organizers' },
  { to: '/promoters', icon: '📣', label: 'Promoters' },
  { to: '/venues', icon: '📍', label: 'Venues' },
  { to: '/lineups', icon: '🎤', label: 'Line-ups' },
  { to: '/payments', icon: '💰', label: 'Payments' },
  { to: '/finance', icon: '🧾', label: 'Income & expenses' },
  { to: '/promos', icon: '🏷', label: 'Promo codes' },
  { to: '/reviews', icon: '★', label: 'Reviews' },
  { to: '/reports', icon: '📈', label: 'Reports' },
];

const CONTENT_NAV = [
  { to: '/banners', icon: '🖼', label: 'Banners' },
  { to: '/testimonials', icon: '💬', label: 'Testimonials' },
  { to: '/faqs', icon: '❓', label: 'FAQs' },
  { to: '/categories', icon: '🗂', label: 'Categories' },
  { to: '/blogs', icon: '✍', label: 'Blogs' },
  { to: '/pages', icon: '📄', label: 'Pages' },
  { to: '/policies', icon: '📜', label: 'Policies' },
  { to: '/menus', icon: '🧭', label: 'Menus' },
];

const MOBILE_NAV = [
  { to: '/', icon: '▦', label: 'Home', end: true },
  { to: '/events', icon: '🎪', label: 'Events' },
  { to: '/bookings', icon: '🎟', label: 'Bookings' },
  { to: '/payments', icon: '💰', label: 'Money' },
  { to: '/promos', icon: '⋯', label: 'More' },
];

export default function AdminLayout() {
  const { session, logout, notifications } = useAdmin();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const unread = notifications.filter((n) => !n.read).length;

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
        <button
          className="btn btn-ghost btn-sm"
          style={unread > 0 ? { borderColor: 'var(--red)', color: 'var(--red-soft)' } : undefined}
          onClick={() => setNotifOpen(true)}
        >
          🔔{unread > 0 ? ` ${unread}` : ''}
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
        <Link to="/profile" className="avatar" title="My profile" style={{ textDecoration: 'none' }}>👤</Link>
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
          <NavLink to="/settings" className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
            <span>⚙</span>
            <span>Settings</span>
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

      {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}
      <ToastHost />
    </>
  );
}

export function ToastHost() {
  const { toastMsg } = useAdmin();
  if (!toastMsg) return null;
  return <div className="toast">{toastMsg}</div>;
}
