import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { GUEST_SITE_URL } from '../store/data';
import NotificationsPanel from './NotificationsPanel';
import { Drawer } from './ui';
import { useBranding } from '../lib/useBranding';
import { clearLiveToken, getLiveToken, liveMe, type LiveStaffMe } from '../lib/liveApi';

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
  { to: '/leads', icon: '📇', label: 'Leads' },
  { to: '/organizers', icon: '🧑‍💼', label: 'Organizers' },
  { to: '/promoters', icon: '📣', label: 'Promoters' },
  { to: '/featured', icon: '⭐', label: 'Featured' },
  { to: '/referrals', icon: '🎁', label: 'Refer & earn' },
  { to: '/venues', icon: '📍', label: 'Venues' },
  { to: '/locations', icon: '🌍', label: 'Locations' },
  { to: '/lineups', icon: '🎤', label: 'Line-ups' },
  { to: '/payments', icon: '💰', label: 'Payments' },
  { to: '/promoter-payouts', icon: '💸', label: 'Promoter payouts' },
  { to: '/invoices', icon: '🧾', label: 'Invoices' },
  { to: '/finance', icon: '💵', label: 'Income & expenses' },
  { to: '/promos', icon: '🏷', label: 'Promo codes' },
  { to: '/reviews', icon: '★', label: 'Reviews' },
  { to: '/reports', icon: '📈', label: 'Reports' },
  { to: '/analytics', icon: '📊', label: 'Analytics' },
];

const CONTENT_NAV = [
  { to: '/banners', icon: '🖼', label: 'Banners' },
  { to: '/reels', icon: '🎬', label: 'Reels' },
  { to: '/careers', icon: '💼', label: 'Careers' },
  { to: '/testimonials', icon: '💬', label: 'Testimonials' },
  { to: '/faqs', icon: '❓', label: 'FAQs' },
  { to: '/categories', icon: '🗂', label: 'Categories' },
  { to: '/trending', icon: '🔥', label: 'Trending searches' },
  { to: '/venue-types', icon: '🏷', label: 'Venue types' },
  { to: '/blogs', icon: '✍', label: 'Blogs' },
  { to: '/pages', icon: '📄', label: 'Pages' },
  { to: '/policies', icon: '📜', label: 'Policies' },
  { to: '/menus', icon: '🧭', label: 'Menus' },
];

// The bottom tab bar only has room for a handful of icons — these four plus
// a "More" button that opens every other section in a drawer (see MoreMenu
// below). "More" used to be a dead-end NavLink straight to /promos, which
// looked like tapping it did nothing since it never revealed the rest of
// the admin's ~30 sections the sidebar shows on desktop.
const MOBILE_NAV = [
  { to: '/', icon: '▦', label: 'Home', end: true },
  { to: '/events', icon: '🎪', label: 'Events' },
  { to: '/bookings', icon: '🎟', label: 'Bookings' },
  { to: '/payments', icon: '💰', label: 'Money' },
];

// A few sections that live outside MAIN_NAV/CONTENT_NAV (no sidebar chip of
// their own) but should still be jump-to-able by name.
const EXTRA_NAV = [
  { to: '/staff', icon: '🧑‍💻', label: 'Staff & roles' },
  { to: '/email-templates', icon: '✉️', label: 'Email templates' },
  { to: '/settings', icon: '⚙', label: 'Settings' },
  { to: '/profile', icon: '👤', label: 'Profile' },
];

// Every admin section, searchable by name — "jump to X" rather than
// searching data records (that's the second half of the search results).
const SECTION_NAV = [...MAIN_NAV, ...CONTENT_NAV, ...EXTRA_NAV];

// Which PERM_MODULES cell (see prebooze-admin's data.ts / prebooze-api's
// staff.service.ts — identical strings on both sides) actually gates each
// route's data on the backend. Mirrors every RequirePermission(MODULE, …)
// call site exactly, including the few surprising reuses (Settings/Reports/
// Refer&earn/Invoices/Promoter payouts all share 'Payments & payouts'
// because their controllers do) — this only decides whether the *link* is
// shown, so it has to match what the API would actually let the request
// through for, not what the label suggests. '/staff' and '/profile' aren't
// in here: staff&role management is Owner-only and isn't part of the
// delegatable matrix at all (OwnerOnlyGuard), and a staffer's own profile
// page has no permission gate on the backend — both handled as special
// cases in canView() below.
const NAV_MODULE: Record<string, string> = {
  '/': 'Dashboard',
  '/events': 'Events & approvals',
  '/bookings': 'Bookings',
  '/abandoned': 'Abandoned carts',
  '/customers': 'Customers',
  '/verifications': 'Verifications (KYC)',
  '/leads': 'Leads',
  '/organizers': 'Organizers',
  '/promoters': 'Promoters',
  '/featured': 'Featured',
  '/referrals': 'Payments & payouts',
  '/venues': 'Venues',
  '/locations': 'Locations',
  '/lineups': 'Lineups',
  '/payments': 'Payments & payouts',
  '/promoter-payouts': 'Payments & payouts',
  '/invoices': 'Payments & payouts',
  '/finance': 'Payments & payouts',
  '/promos': 'Promo codes',
  '/reviews': 'Reviews',
  '/reports': 'Payments & payouts',
  '/analytics': 'Reports',
  '/banners': 'Content',
  '/reels': 'Reels',
  '/careers': 'Careers',
  '/testimonials': 'Content',
  '/faqs': 'Content',
  '/categories': 'Content',
  '/trending': 'Content',
  '/venue-types': 'Content',
  '/blogs': 'Content',
  '/pages': 'Content',
  '/policies': 'Content',
  '/menus': 'Content',
  '/email-templates': 'Content',
  '/settings': 'Payments & payouts',
};

export default function AdminLayout() {
  const { session, logout, notifications, events, bookings, organizers, venues, promoters, customers } = useAdmin();
  const { logoUrl } = useBranding();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  const searchWrapRef = useRef<HTMLDivElement>(null);
  const unread = notifications.filter((n) => !n.read).length;

  // The real permission matrix for whoever is actually signed in — fetched
  // fresh on every mount (not cached in the persisted mock session) so an
  // Owner editing a role's permissions takes effect the next time that
  // staffer's shell loads, not just at their next login. Starts null, so
  // every module-gated link is hidden until this resolves — the alternative
  // (defaulting to visible) would flash the exact "shows everything" bug
  // this exists to fix, even if only for one request's worth of time.
  const [staffMeta, setStaffMeta] = useState<LiveStaffMe | null>(null);
  useEffect(() => {
    if (!getLiveToken()) return;
    liveMe.get().then(setStaffMeta).catch(() => {});
  }, []);

  const visibleTo = useMemo(() => {
    const set = new Set<string>(['/profile']); // self-service, no backend permission gate
    if (staffMeta) {
      for (const [to, module] of Object.entries(NAV_MODULE)) {
        if (staffMeta.permissions[module]?.view) set.add(to);
      }
      // Staff & role management isn't part of the delegatable matrix at all
      // (OwnerOnlyGuard) — hardcoded to the Owner role, not a permission cell.
      if (staffMeta.roleName === 'Owner') set.add('/staff');
    }
    return set;
  }, [staffMeta]);

  const mainNav = useMemo(() => MAIN_NAV.filter((n) => visibleTo.has(n.to)), [visibleTo]);
  const contentNav = useMemo(() => CONTENT_NAV.filter((n) => visibleTo.has(n.to)), [visibleTo]);
  const extraNav = useMemo(() => EXTRA_NAV.filter((n) => visibleTo.has(n.to)), [visibleTo]);
  const mobileNav = useMemo(() => MOBILE_NAV.filter((n) => visibleTo.has(n.to)), [visibleTo]);
  const sectionNav = useMemo(() => SECTION_NAV.filter((n) => visibleTo.has(n.to)), [visibleTo]);

  const results = useMemo<SearchResult[]>(() => {
    const q = query.trim().toLowerCase();
    if (q.length < 2) return [];

    // Section matches first — "jump to X" beats fuzzy record search when
    // the query looks like a page name (e.g. typing "staff" or "reports").
    // Only sections this staffer can actually open — otherwise search would
    // leak the same sections the sidebar is now hiding.
    const sections: SearchResult[] = sectionNav.filter((s) => s.label.toLowerCase().includes(q)).map((s) => ({
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
  }, [query, events, organizers, venues, promoters, bookings, customers, sectionNav]);

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
            clearLiveToken();
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
          {mainNav.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
          {contentNav.length > 0 && <div className="group">Content</div>}
          {contentNav.map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
          <div style={{ flex: 1 }} />
          {extraNav.filter((n) => n.to !== '/profile').map((n) => (
            <NavLink key={n.to} to={n.to} className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}>
              <span>{n.icon}</span>
              <span>{n.label}</span>
            </NavLink>
          ))}
        </nav>

        <main className="content">
          <Outlet />
        </main>
      </div>

      <nav className="bottomnav">
        {mobileNav.map((n) => (
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
        <button
          onClick={() => setMoreOpen(true)}
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 2,
            fontSize: 10,
            fontWeight: 500,
            color: 'var(--muted)',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          <span className="ico" style={{ fontSize: 15 }}>⋯</span>
          More
        </button>
      </nav>

      {moreOpen && <MoreMenu onClose={() => setMoreOpen(false)} mainNav={mainNav} contentNav={contentNav} extraNav={extraNav} />}
      {notifOpen && <NotificationsPanel onClose={() => setNotifOpen(false)} />}
      <ToastHost />
    </>
  );
}

const MOBILE_TAB_PATHS = new Set(['/', '/events', '/bookings', '/payments']);

interface NavItem {
  to: string;
  icon: string;
  label: string;
  end?: boolean;
}

/** Everything the sidebar shows on desktop but the 4-icon bottom tab bar has
 * no room for — MAIN_NAV/CONTENT_NAV/EXTRA_NAV minus whatever's already a
 * tab, grouped the same way the sidebar groups them. Takes the already
 * permission-filtered arrays from AdminLayout rather than the raw
 * constants, so this drawer can't leak a section the sidebar itself hides. */
function MoreMenu({ onClose, mainNav, contentNav, extraNav }: { onClose: () => void; mainNav: NavItem[]; contentNav: NavItem[]; extraNav: NavItem[] }) {
  const mainRest = mainNav.filter((n) => !MOBILE_TAB_PATHS.has(n.to));
  return (
    <Drawer onClose={onClose}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <b className="display" style={{ fontSize: 15 }}>More</b>
        <span onClick={onClose} style={{ cursor: 'pointer', color: 'var(--muted)' }}>✕</span>
      </div>
      <div className="stack" style={{ gap: 2 }}>
        {mainRest.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            onClick={onClose}
            className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}
          >
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
        {contentNav.length > 0 && <div className="group">Content</div>}
        {contentNav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            onClick={onClose}
            className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}
          >
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
        <div className="group">Account</div>
        {extraNav.map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            onClick={onClose}
            className={({ isActive }) => `navitem ${isActive ? 'on' : ''}`}
          >
            <span>{n.icon}</span>
            <span>{n.label}</span>
          </NavLink>
        ))}
      </div>
    </Drawer>
  );
}

export function ToastHost() {
  const { toastMsg } = useAdmin();
  if (!toastMsg) return null;
  return <div className="toast">{toastMsg}</div>;
}
