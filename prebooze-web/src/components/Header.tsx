import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Search, Flame, MapPin, User, Ticket, Heart, Wallet, Gift, CreditCard,
  LifeBuoy, LayoutGrid, Megaphone, Mic, Landmark, LogOut, Camera,
  ClipboardList, Radio, Star, Tag, ShoppingCart, Banknote, Receipt,
  ShieldCheck, Award, Settings as SettingsIcon, Rocket, Globe, Trophy,
  Calendar, QrCode, Activity, Percent, Shield, Users,
  type LucideIcon,
} from 'lucide-react';
import { useApp } from '../store/AppContext';
import { EVENTS, LINEUPS, ORGANIZERS, TRENDING_SEARCHES, VENUES } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import CityPicker from './CityPicker';
import { existingRole, type Role } from '../lib/roles';
import { usePlatformInfo } from '../lib/usePlatformInfo';
import { useCityList } from '../lib/useCityList';
import { toCitySlug, cityHome, cityBrowse, cityVenues, eventPath, venuePath, lineupPath, organizerPath } from '../lib/urls';

type Suggestion = { label: string; type: string; to: string };

/** The ▾ unicode triangle has inconsistent vertical metrics across fonts/
 * OSes — it renders floating well above the text baseline instead of
 * sitting inline with it. An inline SVG chevron gives pixel-consistent
 * alignment everywhere instead. */
function Caret() {
  return (
    <svg className="hdr-caret" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}

type MenuItem = { to: string; label: string; icon: LucideIcon; module?: string | 'owner' };

const ORG_NAV: MenuItem[] = [
  { to: '/organizer', label: 'Dashboard', icon: LayoutGrid },
  { to: '/organizer/events', label: 'Events', icon: Ticket, module: 'Events & wizard' },
  { to: '/organizer/bookings', label: 'Bookings', icon: Users, module: 'Attendees & check-in' },
  { to: '/organizer/scanner', label: 'Scanner', icon: Camera, module: 'Attendees & check-in' },
  { to: '/organizer/guestlist', label: 'Guest list', icon: ClipboardList, module: 'Guest list' },
  { to: '/organizer/live', label: 'Live monitor', icon: Radio, module: 'Attendees & check-in' },
  { to: '/organizer/reviews', label: 'Reviews', icon: Star, module: 'Reviews' },
  { to: '/organizer/coupons', label: 'Promo codes', icon: Tag, module: 'Coupons' },
  { to: '/organizer/carts', label: 'Abandoned carts', icon: ShoppingCart, module: 'Events & wizard' },
  { to: '/organizer/payouts', label: 'Payouts', icon: Banknote, module: 'Payouts & withdrawals' },
  { to: '/organizer/transactions', label: 'Transactions', icon: Receipt, module: 'Payouts & withdrawals' },
  { to: '/organizer/promoters', label: 'Promoters', icon: Megaphone, module: 'Payouts & withdrawals' },
  { to: '/organizer/team', label: 'Team & roles', icon: ShieldCheck, module: 'Settings & team' },
  { to: '/organizer/billing', label: 'Featured & billing', icon: Award, module: 'owner' },
  { to: '/organizer/marketing', label: 'Marketing', icon: Rocket, module: 'owner' },
  { to: '/organizer/settings', label: 'Settings', icon: SettingsIcon, module: 'Settings & team' },
  { to: '/payment-methods', label: 'Payment methods', icon: CreditCard },
  { to: '/help', label: 'Help center', icon: LifeBuoy },
];

const VENUE_HOSTING_NAV: MenuItem[] = [
  { to: '/venue/hosting', label: 'Dashboard', icon: LayoutGrid },
  { to: '/venue/hosting/events', label: 'Events', icon: Ticket, module: 'Events & wizard' },
  { to: '/venue/hosting/bookings', label: 'Bookings', icon: Users, module: 'Attendees & check-in' },
  { to: '/venue/hosting/scanner', label: 'Scanner', icon: QrCode, module: 'Attendees & check-in' },
  { to: '/venue/hosting/guest-list', label: 'Guest list', icon: ClipboardList, module: 'Guest list' },
  { to: '/venue/hosting/live', label: 'Live monitor', icon: Activity, module: 'Attendees & check-in' },
  { to: '/venue/hosting/coupons', label: 'Promo codes', icon: Percent, module: 'Coupons' },
  { to: '/venue/hosting/carts', label: 'Abandoned carts', icon: ShoppingCart, module: 'Events & wizard' },
  { to: '/venue/hosting/ledger', label: 'Payouts', icon: Banknote, module: 'Payouts & withdrawals' },
  { to: '/venue/hosting/marketing', label: 'Marketing', icon: Rocket, module: 'owner' },
  { to: '/venue/hosting/promoters', label: 'Promoters', icon: Megaphone, module: 'Payouts & withdrawals' },
  { to: '/venue/hosting/team', label: 'Team & roles', icon: Shield, module: 'Settings & team' },
  { to: '/venue/hosting/settings', label: 'Settings', icon: SettingsIcon, module: 'Settings & team' },
  { to: '/payment-methods', label: 'Payment methods', icon: CreditCard },
  { to: '/help', label: 'Help center', icon: LifeBuoy },
];

/** Mirrors OrganizerLayout.tsx's own NAV+TeamConsole exactly (see that file
 * for the full permission-module reasoning) — duplicated rather than
 * imported since OrganizerLayout is lazy-loaded and Header isn't; importing
 * it here would pull the whole console's code into the main bundle on every
 * page load. `undefined` module = always visible to a team member; 'owner'
 * = owner only, never a team member regardless of permissions. */
function OrgMenuSection({ isOwner, access, onNavigate }: { isOwner: boolean; access: ReturnType<typeof useApp>['orgTeamAccess']; onNavigate: () => void }) {
  const canView = (module?: string | 'owner') => isOwner || module === undefined || (module !== 'owner' && !!access?.permissions[module]?.view);
  const items = ORG_NAV.filter((n) => canView(n.module));
  return (
    <>
      <div className="cap hdr-menu-cap">{access && !isOwner ? `TEAM — ${access.organizerBrand}` : 'ORGANIZER'}</div>
      {items.map((n) => (
        <Link key={n.to} to={n.to} onClick={onNavigate}>
          <n.icon size={15} /> {n.label}
        </Link>
      ))}
    </>
  );
}

/** Mirrors VenueOrgLayout.tsx's own NAV+TeamConsole — same duplication
 * reasoning as OrgMenuSection above. */
function VenueHostingMenuSection({ isOwner, access, onNavigate }: { isOwner: boolean; access: ReturnType<typeof useApp>['venueTeamAccess']; onNavigate: () => void }) {
  const canView = (module?: string | 'owner') => isOwner || module === undefined || (module !== 'owner' && !!access?.permissions[module]?.view);
  const items = VENUE_HOSTING_NAV.filter((n) => canView(n.module));
  return (
    <>
      <div className="cap hdr-menu-cap">{access && !isOwner ? `TEAM — ${access.venueBrand}` : 'VENUE HOSTING'}</div>
      {items.map((n) => (
        <Link key={n.to} to={n.to} onClick={onNavigate}>
          <n.icon size={15} /> {n.label}
        </Link>
      ))}
    </>
  );
}

/** Self-contained search input + suggestions dropdown — rendered twice by
 * Header (desktop, inline in the header row; mobile, in its own row below
 * the header), each with independent open/close state so opening one never
 * affects the other. The actual query/results/trending list live in Header
 * and are passed down, so both instances share one debounced fetch instead
 * of duplicating network calls. */
function SearchBox({
  className, q, setQ, suggestions, trending, navigate, submitSearch, city,
}: {
  className: string;
  q: string;
  setQ: (v: string) => void;
  suggestions: Suggestion[];
  trending: string[];
  navigate: ReturnType<typeof useNavigate>;
  submitSearch: (e: React.FormEvent) => void;
  city: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  return (
    <form className={className} onSubmit={(e) => { setOpen(false); submitSearch(e); }} ref={ref} style={{ position: 'relative' }}>
      <Search size={16} style={{ flexShrink: 0 }} />
      <input
        placeholder="Search events, artists, venues…"
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => { setQ(e.target.value); setOpen(true); }}
      />
      {open && (
        <div className="ss-list" style={{ top: 'calc(100% + 6px)' }}>
          {q.trim() === '' ? (
            <>
              <div className="tiny muted-2" style={{ padding: '6px 10px 4px', fontWeight: 700, letterSpacing: 0.5, display: 'flex', alignItems: 'center', gap: 5 }}>
                <Flame size={12} /> TRENDING
              </div>
              {trending.map((t) => (
                <button
                  type="button"
                  key={t}
                  className="ss-opt"
                  style={{ display: 'flex', alignItems: 'center', gap: 8 }}
                  onMouseDown={(e) => { e.preventDefault(); setQ(t); setOpen(false); navigate(cityBrowse(city) + '?q=' + encodeURIComponent(t)); }}
                >
                  <Search size={13} style={{ flexShrink: 0, opacity: 0.6 }} /> {t}
                </button>
              ))}
            </>
          ) : suggestions.length ? (
            suggestions.map((s) => (
              <button
                type="button"
                key={s.type + s.to}
                className="ss-opt"
                style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                onMouseDown={(e) => { e.preventDefault(); setOpen(false); setQ(''); navigate(s.to); }}
              >
                <span>{s.label}</span>
                <span className="tag" style={{ fontSize: 9.5 }}>{s.type}</span>
              </button>
            ))
          ) : (
            <div className="ss-empty">No matches — press Enter to search events</div>
          )}
        </div>
      )}
    </form>
  );
}

export default function Header() {
  const { user, city, logout, orgTeamAccess, venueTeamAccess } = useApp();
  const { logoUrl } = usePlatformInfo();
  const heldRole = existingRole(user);
  // A role account's header identity is its brand, not the person's name —
  // guests are the only role that should ever show a personal name here.
  const roleBrand: Record<Role, string | undefined> = {
    organizer: user?.orgBrand,
    promoter: user?.promoterBrand,
    lineup: user?.lineupName,
    venue: user?.venueName,
  };
  const displayName = (heldRole && roleBrand[heldRole]) || user?.name || user?.orgBrand || user?.promoterBrand || user?.lineupName || user?.venueName || 'Profile';
  const navigate = useNavigate();
  const location = useLocation();
  const [cityOpen, setCityOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState('');
  const { cities } = useCityList();

  // live suggestions across events, venues, artists and organizers — real
  // GET /search (debounced) when a backend is configured; the local mock
  // arrays are only the offline/dev-mode fallback (previously this ran
  // year-round against the mock arrays even in production, so anything
  // created after the seed was invisible while typing — GET /search and
  // GET /search/trending already existed and worked, just never called).
  const [liveSuggestions, setLiveSuggestions] = useState<{ label: string; type: string; to: string }[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    const s = q.trim();
    if (!s) { setLiveSuggestions(null); return; }
    const t = setTimeout(() => {
      catalog.search(s).then(setLiveSuggestions).catch(() => setLiveSuggestions([]));
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const suggestions = useMemo(() => {
    if (isBackendEnabled()) return liveSuggestions ?? [];
    const s = q.trim().toLowerCase();
    if (!s) return [];
    const out: { label: string; type: string; to: string }[] = [];
    EVENTS.filter((e) => e.status === 'approved' && e.title.toLowerCase().includes(s)).forEach((e) => {
      const c = e.venue?.city ?? e.privateCity;
      if (c) out.push({ label: e.title, type: 'Event', to: eventPath(c, e.slug) });
    });
    VENUES.filter((v) => v.name.toLowerCase().includes(s)).forEach((v) =>
      out.push({ label: v.name, type: 'Venue', to: venuePath(v.city, v.id) })
    );
    LINEUPS.filter((l) => l.name.toLowerCase().includes(s)).forEach((l) =>
      out.push({ label: l.name, type: 'Artist', to: lineupPath(l.city, l.slug) })
    );
    ORGANIZERS.filter((o) => o.brandName.toLowerCase().includes(s)).forEach((o) =>
      out.push({ label: o.brandName, type: 'Organizer', to: organizerPath(o.city, o.id) })
    );
    return out.slice(0, 7);
  }, [q, liveSuggestions]);

  const [liveTrending, setLiveTrending] = useState<string[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.trending().then(setLiveTrending).catch(() => setLiveTrending([]));
  }, []);
  const trending = liveTrending ?? (isBackendEnabled() ? [] : TRENDING_SEARCHES);

  // First visit: open the city picker, but only on the homepage — this used
  // to fire on any first page load, including a deep link straight from an
  // ad (an event page), where it rendered as a modal wall completely
  // covering the event someone just clicked through to see, right as they
  // landed. Deferred until they actually reach '/' instead of being skipped
  // outright: `pb_geo_done` is only set at the point this actually shows,
  // so a session that starts on a deep link still gets the prompt if/when
  // it later reaches the homepage. Geo-detection itself stays behind the
  // picker's own "Detect my location" button — auto-firing a geolocation
  // permission prompt on page load is what Lighthouse flags as reading as
  // suspicious, so opening the modal is as far as this goes on its own.
  useEffect(() => {
    // "The homepage" is now either the bare '/' (pre-redirect, or offline
    // mode) or a real city's home page ('/hyderabad') — checking for exact
    // '/' alone would mean this basically never fires for real traffic,
    // since a real visit almost always lands on the city-prefixed home
    // page, not the bare root. Validated against the real city list (not
    // just "one path segment") so this doesn't also fire on other
    // single-segment routes like /login or /wallet.
    const [first, ...rest] = location.pathname.split('/').filter(Boolean);
    const isHome = !first || (rest.length === 0 && (cities ?? []).some((c) => toCitySlug(c.name) === first));
    if (!isHome) return;
    if (!localStorage.getItem('pb_city_manual') && !localStorage.getItem('pb_geo_done')) {
      localStorage.setItem('pb_geo_done', '1');
      setCityOpen(true);
    }
  }, [location.pathname, cities]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate(cityBrowse(city) + (q ? `?q=${encodeURIComponent(q)}` : ''));
  };

  return (
    <header className="hdr">
      <div className="container hdr-in">
        <Link to={cityHome(city)} className="hdr-logo">
          <img src={logoUrl || '/prebooze-logo.png'} alt="Prebooze" width={203} height={42} fetchPriority="high" />
        </Link>

        <SearchBox className="hdr-search" q={q} setQ={setQ} suggestions={suggestions} trending={trending} navigate={navigate} submitSearch={submitSearch} city={city} />

        <button className="hdr-city" onClick={() => setCityOpen(true)}>
          <MapPin size={14} /> {city} <Caret />
        </button>
        <CityPicker open={cityOpen} onClose={() => setCityOpen(false)} />

        <span className="hdr-spacer" />

        <nav className="hdr-links">
          <Link to={cityBrowse(city)}>Events</Link>
          <Link to={cityVenues(city)}>Venues</Link>
          {!heldRole && <Link to="/host">Join us</Link>}
          {user && !heldRole && <Link to="/bookings">My Bookings</Link>}
        </nav>

        {user ? (
          <div className="hdr-user" role="button" tabIndex={0} onClick={() => setMenuOpen((o) => !o)}>
            {user.isOrganizer && user.orgLogoUrl ? (
              <img src={user.orgLogoUrl} alt="" className="avatar" style={{ objectFit: 'cover' }} />
            ) : user.isVenue && user.venueLogoUrl ? (
              <img src={user.venueLogoUrl} alt="" className="avatar" style={{ objectFit: 'cover' }} />
            ) : user.isLineup && user.lineupLogoUrl ? (
              <img src={user.lineupLogoUrl} alt="" className="avatar" style={{ objectFit: 'cover' }} />
            ) : user.isPromoter && user.promoterLogoUrl ? (
              <img src={user.promoterLogoUrl} alt="" className="avatar" style={{ objectFit: 'cover' }} />
            ) : user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="avatar" style={{ objectFit: 'cover' }} />
            ) : (
              <span className="avatar"><User size={16} /></span>
            )}
            <span className="hdr-user-name">{displayName.split(' ')[0]}</span> <Caret />
            {menuOpen && (
              <div className="menu hdr-menu-scroll" onClick={(e) => e.stopPropagation()}>
                {/* Any elevated role (organizer/promoter/lineup/venue) is a
                    business/role account — guest features (booking, wishlist,
                    wallet, referrals) are hidden; one number = one role. Each
                    section below mirrors that role's own console sidebar
                    exactly (see OrganizerLayout.tsx etc.) — previously just a
                    single link into the console, which meant Payment methods/
                    Help center only existed as generic top-level items here.
                    Now every option lives contextually under its own role's
                    section, same "show the same options inside dashboard
                    menus too" reasoning that put them in each sidebar. */}
                {!heldRole && (
                  <>
                    <Link to="/profile" onClick={() => setMenuOpen(false)}>
                      <User size={15} /> My profile
                    </Link>
                    <Link to="/bookings" onClick={() => setMenuOpen(false)}>
                      <Ticket size={15} /> My bookings
                    </Link>
                    <Link to="/wishlist" onClick={() => setMenuOpen(false)}>
                      <Heart size={15} /> Wishlist & favourites
                    </Link>
                    <Link to="/wallet" onClick={() => setMenuOpen(false)}>
                      <Wallet size={15} /> Wallet
                    </Link>
                    <Link to="/refer" onClick={() => setMenuOpen(false)}>
                      <Gift size={15} /> Refer & earn
                    </Link>
                    <Link to="/payment-methods" onClick={() => setMenuOpen(false)}>
                      <CreditCard size={15} /> Payment methods
                    </Link>
                    <Link to="/help" onClick={() => setMenuOpen(false)}>
                      <LifeBuoy size={15} /> Help center
                    </Link>
                  </>
                )}
                {(user.isOrganizer || orgTeamAccess) && (
                  <OrgMenuSection
                    isOwner={user.isOrganizer}
                    access={orgTeamAccess}
                    onNavigate={() => setMenuOpen(false)}
                  />
                )}
                {user.isPromoter && (
                  <>
                    <div className="cap hdr-menu-cap">PROMOTER</div>
                    <Link to="/promoter" onClick={() => setMenuOpen(false)}><LayoutGrid size={15} /> Dashboard</Link>
                    <Link to="/promoter/promotions" onClick={() => setMenuOpen(false)}><Megaphone size={15} /> My promotions</Link>
                    <Link to="/promoter/city-events" onClick={() => setMenuOpen(false)}><Globe size={15} /> Promote any event</Link>
                    <Link to="/promoter/earnings" onClick={() => setMenuOpen(false)}><Banknote size={15} /> Earnings</Link>
                    <Link to="/promoter/team" onClick={() => setMenuOpen(false)}><Users size={15} /> Team</Link>
                    <Link to="/promoter/leaderboard" onClick={() => setMenuOpen(false)}><Trophy size={15} /> Leaderboard</Link>
                    <Link to="/promoter/subscription" onClick={() => setMenuOpen(false)}><CreditCard size={15} /> Subscription</Link>
                    <Link to="/promoter/settings" onClick={() => setMenuOpen(false)}><SettingsIcon size={15} /> Profile & settings</Link>
                    <Link to="/payment-methods" onClick={() => setMenuOpen(false)}><CreditCard size={15} /> Payment methods</Link>
                    <Link to="/help" onClick={() => setMenuOpen(false)}><LifeBuoy size={15} /> Help center</Link>
                  </>
                )}
                {user.isLineup && (
                  <>
                    <div className="cap hdr-menu-cap">ARTIST</div>
                    <Link to="/artist" onClick={() => setMenuOpen(false)}><LayoutGrid size={15} /> Dashboard</Link>
                    <Link to="/artist/profile" onClick={() => setMenuOpen(false)}><SettingsIcon size={15} /> Profile & settings</Link>
                    <Link to="/artist/billing" onClick={() => setMenuOpen(false)}><Star size={15} /> Featured & billing</Link>
                    <Link to="/payment-methods" onClick={() => setMenuOpen(false)}><CreditCard size={15} /> Payment methods</Link>
                    <Link to="/help" onClick={() => setMenuOpen(false)}><LifeBuoy size={15} /> Help center</Link>
                  </>
                )}
                {user.isVenue && (
                  <>
                    <div className="cap hdr-menu-cap">VENUE</div>
                    <Link to="/venue" onClick={() => setMenuOpen(false)}><LayoutGrid size={15} /> Dashboard</Link>
                    <Link to="/venue/listing" onClick={() => setMenuOpen(false)}><Landmark size={15} /> My listing</Link>
                    <Link to="/venue/events" onClick={() => setMenuOpen(false)}><Calendar size={15} /> Events here</Link>
                    <Link to="/venue/reviews" onClick={() => setMenuOpen(false)}><Star size={15} /> Reviews</Link>
                    <Link to="/venue/billing" onClick={() => setMenuOpen(false)}><Award size={15} /> Featured & billing</Link>
                    <Link to="/venue/settings" onClick={() => setMenuOpen(false)}><SettingsIcon size={15} /> Settings</Link>
                    <Link to="/payment-methods" onClick={() => setMenuOpen(false)}><CreditCard size={15} /> Payment methods</Link>
                    <Link to="/help" onClick={() => setMenuOpen(false)}><LifeBuoy size={15} /> Help center</Link>
                  </>
                )}
                {(user.isVenue || venueTeamAccess) && (
                  <VenueHostingMenuSection
                    isOwner={!!user.isVenue}
                    access={venueTeamAccess}
                    onNavigate={() => setMenuOpen(false)}
                  />
                )}
                {!heldRole && (
                  <Link to="/host" onClick={() => setMenuOpen(false)}>
                    <Mic size={15} /> Join us
                  </Link>
                )}
                <div className="sep" />
                <button
                  onClick={() => {
                    logout();
                    setMenuOpen(false);
                    navigate('/');
                  }}
                >
                  <LogOut size={15} /> Log out
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="btn btn-pri btn-sm">
            Login
          </Link>
        )}
      </div>

      {/* Mobile-only search row — .hdr-search hides at the same breakpoint
          this shows at (see index.css), so search stays reachable on
          mobile instead of just vanishing with the desktop nav links.
          .hdr-city moves down here too on mobile (hidden in its usual spot
          above, see index.css) — the top row is already tight with the
          logo and account button competing for space, but this row has
          nothing else in it, so the city name can stay fully visible
          here instead of shrinking to an icon-only button up top. */}
      <div className="container hdr-search-mobile-row">
        <SearchBox className="hdr-search hdr-search-mobile" q={q} setQ={setQ} suggestions={suggestions} trending={trending} navigate={navigate} submitSearch={submitSearch} city={city} />
        <button className="hdr-city hdr-city-mobile" onClick={() => setCityOpen(true)}>
          <MapPin size={14} /> {city} <Caret />
        </button>
        {/* .hdr-links (Events/Venues/Join us/My Bookings) hides
            entirely on mobile — see index.css — and there's no hamburger/
            bottom-nav in this app to fall back on, so a logged-out mobile
            visitor previously had no way to reach Join us from the
            header at all. Same !heldRole gate as the desktop link/menu
            entry — an existing organizer/promoter/venue/lineup doesn't
            need to see it again. */}
        {!heldRole && (
          <Link to="/host" className="hdr-host-mobile">
            <Mic size={14} /> Join us
          </Link>
        )}
      </div>
    </header>
  );
}
