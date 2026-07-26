import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, LINEUPS, ORGANIZERS, TRENDING_SEARCHES, VENUES } from '../data/mock';
import CityPicker from './CityPicker';
import { existingRole } from '../lib/roles';
import { usePlatformInfo } from '../lib/usePlatformInfo';

export default function Header() {
  const { user, city, logout } = useApp();
  const { logoUrl } = usePlatformInfo();
  const heldRole = existingRole(user);
  const navigate = useNavigate();
  const [cityOpen, setCityOpen] = useState(false);
  const [autoDetect, setAutoDetect] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setSearchOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  // live suggestions across events, venues, artists and organizers
  const suggestions = useMemo(() => {
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
  }, [q]);

  // first visit: open the city picker and try geo-detection once
  useEffect(() => {
    if (!localStorage.getItem('pb_city_manual') && !localStorage.getItem('pb_geo_done')) {
      localStorage.setItem('pb_geo_done', '1');
      setAutoDetect(true);
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
          <img src={logoUrl || '/prebooze-logo.png'} alt="Prebooze" />
        </Link>

        <form className="hdr-search" onSubmit={(e) => { setSearchOpen(false); submitSearch(e); }} ref={searchRef} style={{ position: 'relative' }}>
          🔍
          <input
            placeholder="Search events, artists, venues…"
            value={q}
            onFocus={() => setSearchOpen(true)}
            onChange={(e) => { setQ(e.target.value); setSearchOpen(true); }}
          />
          {searchOpen && (
            <div className="ss-list" style={{ top: 'calc(100% + 6px)' }}>
              {q.trim() === '' ? (
                <>
                  <div className="tiny muted-2" style={{ padding: '6px 10px 4px', fontWeight: 700, letterSpacing: 0.5 }}>🔥 TRENDING</div>
                  {TRENDING_SEARCHES.map((t) => (
                    <button
                      type="button"
                      key={t}
                      className="ss-opt"
                      onMouseDown={(e) => { e.preventDefault(); setQ(t); setSearchOpen(false); navigate('/browse?q=' + encodeURIComponent(t)); }}
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
                    onMouseDown={(e) => { e.preventDefault(); setSearchOpen(false); setQ(''); navigate(s.to); }}
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

        <button className="hdr-city" onClick={() => { setAutoDetect(false); setCityOpen(true); }}>
          📍 {city} ▾
        </button>
        <CityPicker open={cityOpen} onClose={() => setCityOpen(false)} autoDetect={autoDetect} />

        <span className="hdr-spacer" />

        <nav className="hdr-links">
          <Link to="/browse">Events</Link>
          <Link to="/venues">Venues</Link>
          {!heldRole && <Link to="/host">Host with us</Link>}
          {user && !heldRole && <Link to="/bookings">My Bookings</Link>}
        </nav>

        {user ? (
          <div className="hdr-user" role="button" tabIndex={0} onClick={() => setMenuOpen((o) => !o)}>
            <span className="avatar">👤</span>
            {user.name ? user.name.split(' ')[0] : 'Profile'} ▾
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
                {user.isOrganizer && (
                  <Link to="/organizer" onClick={() => setMenuOpen(false)}>
                    ▦ Organizer console
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
    </header>
  );
}
