import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, LINEUPS, ORGANIZERS, TRENDING_SEARCHES, VENUES } from '../data/mock';
import { catalog } from '../api';
import { isBackendEnabled } from '../api/client';
import CityPicker from './CityPicker';
import { existingRole } from '../lib/roles';
import { usePlatformInfo } from '../lib/usePlatformInfo';

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

/** Self-contained search input + suggestions dropdown — rendered twice by
 * Header (desktop, inline in the header row; mobile, in its own row below
 * the header), each with independent open/close state so opening one never
 * affects the other. The actual query/results/trending list live in Header
 * and are passed down, so both instances share one debounced fetch instead
 * of duplicating network calls. */
function SearchBox({
  className, q, setQ, suggestions, trending, navigate, submitSearch,
}: {
  className: string;
  q: string;
  setQ: (v: string) => void;
  suggestions: Suggestion[];
  trending: string[];
  navigate: ReturnType<typeof useNavigate>;
  submitSearch: (e: React.FormEvent) => void;
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
      🔍
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
              <div className="tiny muted-2" style={{ padding: '6px 10px 4px', fontWeight: 700, letterSpacing: 0.5 }}>🔥 TRENDING</div>
              {trending.map((t) => (
                <button
                  type="button"
                  key={t}
                  className="ss-opt"
                  onMouseDown={(e) => { e.preventDefault(); setQ(t); setOpen(false); navigate('/browse?q=' + encodeURIComponent(t)); }}
                >
                  🔎 {t}
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
  const { user, city, logout, orgTeamAccess } = useApp();
  const { logoUrl } = usePlatformInfo();
  const heldRole = existingRole(user);
  // A role account's display name lives on its brand field, not user.name —
  // organizer/venue applicants in particular never fill in a guest name at
  // all (they skip guest profile completion), so falling back to "Profile"
  // left the header looking broken for every approved/pending role account.
  const displayName = user?.name || user?.orgBrand || user?.promoterBrand || user?.lineupName || user?.venueName || 'Profile';
  const navigate = useNavigate();
  const [cityOpen, setCityOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState('');

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
    EVENTS.filter((e) => e.status === 'approved' && e.title.toLowerCase().includes(s)).forEach((e) =>
      out.push({ label: e.title, type: 'Event', to: `/events/${e.slug}` })
    );
    VENUES.filter((v) => v.name.toLowerCase().includes(s)).forEach((v) =>
      out.push({ label: v.name, type: 'Venue', to: `/venues/${v.id}` })
    );
    LINEUPS.filter((l) => l.name.toLowerCase().includes(s)).forEach((l) =>
      out.push({ label: l.name, type: 'Artist', to: `/lineup/${l.slug}` })
    );
    ORGANIZERS.filter((o) => o.brandName.toLowerCase().includes(s)).forEach((o) =>
      out.push({ label: o.brandName, type: 'Organizer', to: `/organizers/${o.id}` })
    );
    return out.slice(0, 7);
  }, [q, liveSuggestions]);

  const [liveTrending, setLiveTrending] = useState<string[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.trending().then(setLiveTrending).catch(() => setLiveTrending([]));
  }, []);
  const trending = liveTrending ?? (isBackendEnabled() ? [] : TRENDING_SEARCHES);

  // first visit: open the city picker (geo-detection itself stays behind
  // the picker's own "Detect my location" button — auto-firing a
  // geolocation permission prompt on page load is what Lighthouse flags
  // as reading as suspicious, so opening the modal is as far as this goes
  // on its own).
  useEffect(() => {
    if (!localStorage.getItem('pb_city_manual') && !localStorage.getItem('pb_geo_done')) {
      localStorage.setItem('pb_geo_done', '1');
      setCityOpen(true);
    }
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/browse' + (q ? `?q=${encodeURIComponent(q)}` : ''));
  };

  return (
    <header className="hdr">
      <div className="container hdr-in">
        <Link to="/" className="hdr-logo">
          <img src={logoUrl || '/prebooze-logo.png'} alt="Prebooze" width={203} height={42} fetchPriority="high" />
        </Link>

        <SearchBox className="hdr-search" q={q} setQ={setQ} suggestions={suggestions} trending={trending} navigate={navigate} submitSearch={submitSearch} />

        <button className="hdr-city" onClick={() => setCityOpen(true)}>
          📍 {city} <Caret />
        </button>
        <CityPicker open={cityOpen} onClose={() => setCityOpen(false)} />

        <span className="hdr-spacer" />

        <nav className="hdr-links">
          <Link to="/browse">Events</Link>
          <Link to="/venues">Venues</Link>
          {!heldRole && <Link to="/host">Host with us</Link>}
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
              <span className="avatar">👤</span>
            )}
            {displayName.split(' ')[0]} <Caret />
            {menuOpen && (
              <div className="menu" onClick={(e) => e.stopPropagation()}>
                {/* Any elevated role (organizer/promoter/lineup/venue) is a
                    business/role account — guest features (booking, wishlist,
                    wallet, referrals) are hidden; one number = one role. */}
                {!heldRole && (
                  <>
                    <Link to="/profile" onClick={() => setMenuOpen(false)}>
                      👤 My profile
                    </Link>
                    <Link to="/bookings" onClick={() => setMenuOpen(false)}>
                      🎟 My bookings
                    </Link>
                    <Link to="/wishlist" onClick={() => setMenuOpen(false)}>
                      ❤️ Wishlist & favourites
                    </Link>
                    <Link to="/wallet" onClick={() => setMenuOpen(false)}>
                      👛 Wallet
                    </Link>
                    <Link to="/refer" onClick={() => setMenuOpen(false)}>
                      🎁 Refer & earn
                    </Link>
                  </>
                )}
                <Link to="/payment-methods" onClick={() => setMenuOpen(false)}>
                  💳 Payment methods
                </Link>
                <Link to="/help" onClick={() => setMenuOpen(false)}>
                  🛟 Help center
                </Link>
                {(user.isOrganizer || orgTeamAccess) && (
                  <Link to="/organizer" onClick={() => setMenuOpen(false)}>
                    ▦ {orgTeamAccess && !user.isOrganizer ? `Team console — ${orgTeamAccess.organizerBrand}` : 'Organizer console'}
                  </Link>
                )}
                {user.isPromoter && (
                  <Link to="/promoter" onClick={() => setMenuOpen(false)}>
                    📣 Promoter console
                  </Link>
                )}
                {user.isLineup && (
                  <Link to="/artist" onClick={() => setMenuOpen(false)}>
                    🎤 Artist console
                  </Link>
                )}
                {user.isVenue && (
                  <Link to="/venue" onClick={() => setMenuOpen(false)}>
                    🏛 Venue console
                  </Link>
                )}
                {!heldRole && (
                  <Link to="/host" onClick={() => setMenuOpen(false)}>
                    🎤 Host with us
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
                  ↩ Log out
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
          mobile instead of just vanishing with the desktop nav links. */}
      <div className="container hdr-search-mobile-row">
        <SearchBox className="hdr-search hdr-search-mobile" q={q} setQ={setQ} suggestions={suggestions} trending={trending} navigate={navigate} submitSearch={submitSearch} />
      </div>
    </header>
  );
}
