import { useMemo, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { GUEST_SITE_URL } from '../store/data';
import NotificationsPanel from './NotificationsPanel';
import { useBranding } from '../lib/useBranding';

interface SearchResult {
  type: string;
  label: string;
  sub: string;
  to: string;
}

const MAIN_NAV = [
  { to: '/', icon: '▦', label: 'Dashboard', end: true },
  { to: '/events', icon: '🎪', label: 'Events' },
  { to: '/bookings', icon: '🎟', label: 'Bookings' },
  { to: '/abandoned', icon: '🛒', label: 'Abandoned carts' },
  { to: '/customers', icon: '👥', label: 'Customers' },
  { to: '/verifications', icon: '🛂', label: 'Verifications' },
  { to: '/organizers', icon: '🧑‍💼', label: 'Organizers' },
  { to: '/promoters', icon: '📣', label: 'Promoters' },
  { to: '/featured', icon: '⭐', label: 'Featured' },
  { to: '/referrals', icon: '🎁', label: 'Refer & earn' },
  { to: '/venues', icon: '📍', label: 'Venues' },
  { to: '/locations', icon: '🌍', label: 'Locations' },
  { to: '/lineups', icon: '🎤', label: 'Line-ups' },
  { to: '/payments', icon: '💰', label: 'Payments' },
  { to: '/invoices', icon: '🧾', label: 'Invoices' },
  { to: '/finance', icon: '💵', label: 'Income & expenses' },
  { to: '/promos', icon: '🏷', label: 'Promo codes' },
  { to: '/reviews', icon: '★', label: 'Reviews' },
  { to: '/reports', icon: '📈', label: 'Reports' },
];

const CONTENT_NAV = [
  { to: '/banners', icon: '🖼', label: 'Banners' },
  { to: '/reels', icon: '🎬', label: 'Reels' },
  { to: '/careers', icon: '💼', label: 'Careers' },
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

// A few sections that live outside MAIN_NAV/CONTENT_NAV (no sidebar chip of
// their own) but should still be jump-to-able by name.
const EXTRA_NAV = [
  { to: '/staff', icon: '🧑‍💻', label: 'Staff & roles' },
  { to: '/email-templates', icon: '✉️', label: 'Email templates' },
  { to: '/subscription-plans', icon: '💳', label: 'Subscription plans (live)' },
  { to: '/bookings-live', icon: '🎟', label: 'Bookings (live)' },
  { to: '/customers-live', icon: '👥', label: 'Customers (live)' },
  { to: '/directory-live', icon: '🧑‍💼', label: 'Directory (live)' },
  { to: '/content-live', icon: '📄', label: 'Content (live)' },
  { to: '/ops-live', icon: '🏷', label: 'Categories/Promos/Reels/Reviews (live)' },
  { to: '/careers-referrals-live', icon: '💼', label: 'Careers & referrals (live)' },
  { to: '/invoices-live', icon: '🧾', label: 'Invoices (live)' },
  { to: '/email-templates-live', icon: '✉️', label: 'Email templates (live)' },
  { to: '/event-ops-live', icon: '📷', label: 'Guest list, live monitor & manual booking (live)' },
  { to: '/settings', icon: '⚙', label: 'Settings' },
  { to: '/profile', icon: '👤', label: 'Profile' },
];

// Every admin section, searchable by name — "jump to X" rather than
// searching data records (that's the second half of the search results).
const SECTION_NAV = [...MAIN_NAV, ...CONTENT_NAV, ...EXTRA_NAV];

export default function AdminLayout() {
  const { session, logout, notifications, events, bookings, organizers, venues, promoters, customers } = useAdmin();
  const { logoUrl } = useBranding();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    // Section matches first — "jump to X" beats fuzzy record search when
    // the query looks like a page name (e.g. typing "staff" or "reports").
    const sections: SearchResult[] = SECTION_NAV.filter((s) => s.label.toLowerCase().includes(q)).map((s) => ({
      type: 'Section', label: s.label, sub: s.to, to: s.to,
    }));

    const records: SearchResult[] = [];
    for (const e of events) if (e.title.toLowerCase().includes(q)) records.push({ type: 'Event', label: e.title, sub: e.city, to: `/events/${e.id}` });
    for (const o of organizers) if (o.name.toLowerCase().includes(q)) records.push({ type: 'Organizer', label: o.name, sub: o.city, to: `/organizers/${o.id}` });
    for (const v of venues) if (v.name.toLowerCase().includes(q)) records.push({ type: 'Venue', label: v.name, sub: v.city, to: `/venues/${v.id}` });
    for (const p of promoters) if (p.name.toLowerCase().includes(q)) records.push({ type: 'Promoter', label: p.name, sub: p.city, to: `/promoters/${p.id}` });
    for (const b of bookings) if (b.id.toLowerCase().includes(q) || b.guest.toLowerCase().includes(q) || b.phone.includes(q)) records.push({ type: 'Booking', label: b.id, sub: b.guest, to: `/bookings?q=${encodeURIComponent(b.id)}` });
    for (const c of customers) if (c.name.toLowerCase().includes(q) || (c.phone ?? '').includes(q)) records.push({ type: 'Customer', label: c.name, sub: c.phone ?? '', to: '/customers' });

    return [...sections.slice(0, 3), ...records].slice(0, 8);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, events, organizers, venues, promoters, bookings, customers]);

  const goTo = (r: SearchResult) => {
    navigate(r.to);
    setQuery('');
    setFocused(false);
  };

  if (!session) return <Navigate to="/login" replace />;

  return (
    <>
      <header className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <img src={logoUrl || '/logo.png'} alt="Prebooze" />
          <span className="role-tag">{session.role === 'staff' ? 'STAFF' : 'ADMIN'}</span>
        </div>
        <div ref={searchWrapRef} className="search-box hide-mobile" style={{ flex: 1, maxWidth: 420, position: 'relative' }}>
          <span style={{ opacity: 0.6 }}>🔍</span>
          <input
            placeholder="Search bookings, events, users…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setTimeout(() => setFocused(false), 120)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && results[0]) goTo(results[0]);
              if (e.key === 'Escape') { setQuery(''); setFocused(false); }
            }}
          />
          {focused && query.trim().length >= 2 && (
            <div
              className="card"
              style={{
                position: 'absolute', top: '110%', left: 0, right: 0, zIndex: 50,
                padding: 6, maxHeight: 320, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2,
              }}
            >
              {results.length === 0 && <div className="tiny muted" style={{ padding: '6px 8px' }}>No matches for "{query}"</div>}
              {results.map((r, i) => (
                <button
                  key={r.type + r.label + i}
                  onMouseDown={() => goTo(r)}
                  style={{ display: 'flex', justifyContent: 'space-between', gap: 8, textAlign: 'left', background: 'none', border: 'none', padding: '6px 8px', borderRadius: 6, cursor: 'pointer', color: 'var(--text)' }}
                  onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(139,195,74,.1)')}
                  onMouseLeave={(e) => (e.currentTarget.style.background = 'none')}
                >
                  <span style={{ fontSize: 12.5 }}>
                    <span className="tiny muted" style={{ marginRight: 6 }}>{r.type}</span>
                    {r.label}
                  </span>
                  <span className="tiny muted">{r.sub}</span>
                </button>
              ))}
            </div>
          )}
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
          <NavLink to="/email-templates" className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
            <span>✉️</span>
            <span>Email templates</span>
          </NavLink>
          <NavLink to="/subscription-plans" className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
            <span>💳</span>
            <span>Subscription plans (live)</span>
          </NavLink>
          <NavLink to="/bookings-live" className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
            <span>🎟</span>
            <span>Bookings (live)</span>
          </NavLink>
          <NavLink to="/customers-live" className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
            <span>👥</span>
            <span>Customers (live)</span>
          </NavLink>
          <NavLink to="/directory-live" className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
            <span>🧑‍💼</span>
            <span>Directory (live)</span>
          </NavLink>
          <NavLink to="/content-live" className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
            <span>📄</span>
            <span>Content (live)</span>
          </NavLink>
          <NavLink to="/ops-live" className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
            <span>🏷</span>
            <span>Categories/Promos/Reels/Reviews (live)</span>
          </NavLink>
          <NavLink to="/careers-referrals-live" className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
            <span>💼</span>
            <span>Careers &amp; referrals (live)</span>
          </NavLink>
          <NavLink to="/invoices-live" className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
            <span>🧾</span>
            <span>Invoices (live)</span>
          </NavLink>
          <NavLink to="/email-templates-live" className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
            <span>✉️</span>
            <span>Email templates (live)</span>
          </NavLink>
          <NavLink to="/event-ops-live" className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
            <span>📷</span>
            <span>Guest list, live monitor &amp; manual booking (live)</span>
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
