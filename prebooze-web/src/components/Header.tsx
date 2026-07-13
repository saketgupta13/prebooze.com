import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, venueById } from '../data/mock';

export default function Header() {
  const { user, city, setCity, logout } = useApp();
  const navigate = useNavigate();
  const [cityOpen, setCityOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState('');
  const [cityQuery, setCityQuery] = useState('');
  const cityRef = useRef<HTMLDivElement>(null);

  // only cities that actually have live events
  const eventCities = useMemo(
    () =>
      Array.from(
        new Set(
          EVENTS.filter((e) => e.status === 'approved')
            .map((e) => venueById(e.venueId)?.city)
            .filter((c): c is string => !!c)
        )
      ).sort(),
    []
  );
  const filteredCities = eventCities.filter((c) => c.toLowerCase().includes(cityQuery.toLowerCase()));

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (cityRef.current && !cityRef.current.contains(e.target as Node)) { setCityOpen(false); setCityQuery(''); }
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    navigate('/browse' + (q ? `?q=${encodeURIComponent(q)}` : ''));
  };

  return (
    <header className="hdr">
      <div className="container hdr-in">
        <Link to="/" className="hdr-logo">
          <img src="/prebooze-logo.png" alt="Prebooze" />
        </Link>

        <form className="hdr-search" onSubmit={submitSearch}>
          🔍
          <input
            placeholder="Search events, artists, venues…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </form>

        <div className="hdr-city" ref={cityRef} onClick={() => setCityOpen((o) => !o)}>
          📍 {city} ▾
          {cityOpen && (
            <div className="menu" onClick={(e) => e.stopPropagation()}>
              <input
                placeholder="Search city…"
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                style={{ width: '100%', marginBottom: 6, padding: '7px 10px' }}
                autoFocus
              />
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {filteredCities.map((c) => (
                  <button
                    key={c}
                    onClick={() => { setCity(c); setCityOpen(false); setCityQuery(''); }}
                  >
                    {c === city ? '✓ ' : ''}{c}
                  </button>
                ))}
                {filteredCities.length === 0 && <div className="ss-empty">No cities found</div>}
              </div>
            </div>
          )}
        </div>

        <span className="hdr-spacer" />

        <nav className="hdr-links">
          <Link to="/browse">Events</Link>
          <Link to="/venues">Venues</Link>
          <Link to="/host">Host with us</Link>
          {user && <Link to="/bookings">My Bookings</Link>}
        </nav>

        {user ? (
          <button className="hdr-user" onClick={() => setMenuOpen((o) => !o)}>
            <span className="avatar">👤</span>
            {user.name ? user.name.split(' ')[0] : 'Profile'} ▾
            {menuOpen && (
              <div className="menu" onClick={(e) => e.stopPropagation()}>
                <Link to="/profile" onClick={() => setMenuOpen(false)}>
                  👤 My profile
                </Link>
                <Link to="/bookings" onClick={() => setMenuOpen(false)}>
                  🎟 My bookings
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
                {!user.isOrganizer && !user.isPromoter && (
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
          </button>
        ) : (
          <Link to="/login" className="btn btn-pri btn-sm">
            Login
          </Link>
        )}
      </div>
    </header>
  );
}
