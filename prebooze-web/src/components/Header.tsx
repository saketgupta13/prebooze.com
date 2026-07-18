import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  const [detecting, setDetecting] = useState(false);
  const [geoMsg, setGeoMsg] = useState('');
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

  // Automatic location detection — browser geolocation → reverse-geocode → match
  // against cities that have events. A manual city choice always wins.
  const detect = useCallback(
    (auto = false) => {
      if (!navigator.geolocation) {
        if (!auto) setGeoMsg('Location not supported on this device');
        return;
      }
      setDetecting(true);
      setGeoMsg('');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const r = await fetch(
              `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${pos.coords.latitude}&longitude=${pos.coords.longitude}&localityLanguage=en`
            );
            const d = await r.json();
            const detected = (d.city || d.locality || '').trim();
            const match = eventCities.find((c) => c.toLowerCase() === detected.toLowerCase());
            if (match) {
              setCity(match);
              setGeoMsg(`📍 Detected ${match}`);
              setCityOpen(false);
            } else {
              setGeoMsg(detected ? `No events in ${detected} yet — pick a city` : 'Couldn’t detect your city');
            }
          } catch {
            setGeoMsg('Couldn’t detect your city');
          }
          setDetecting(false);
        },
        () => {
          setDetecting(false);
          if (!auto) setGeoMsg('Location permission denied');
        },
        { timeout: 8000 }
      );
    },
    [eventCities, setCity]
  );

  // auto-detect once, on first visit, only until the user picks a city manually
  useEffect(() => {
    if (!localStorage.getItem('pb_city_manual') && !localStorage.getItem('pb_geo_done')) {
      localStorage.setItem('pb_geo_done', '1');
      detect(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
              <button
                className="accent"
                style={{ fontWeight: 700 }}
                disabled={detecting}
                onClick={() => detect(false)}
              >
                {detecting ? '📡 Detecting your city…' : '📍 Use my current location'}
              </button>
              {geoMsg && <div className="ss-empty" style={{ paddingTop: 4, paddingBottom: 6 }}>{geoMsg}</div>}
              <input
                placeholder="Search city…"
                value={cityQuery}
                onChange={(e) => setCityQuery(e.target.value)}
                style={{ width: '100%', margin: '6px 0', padding: '7px 10px' }}
                autoFocus
              />
              <div style={{ maxHeight: 240, overflowY: 'auto' }}>
                {filteredCities.map((c) => (
                  <button
                    key={c}
                    onClick={() => {
                      setCity(c);
                      localStorage.setItem('pb_city_manual', '1');
                      setCityOpen(false);
                      setCityQuery('');
                    }}
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
          <div className="hdr-user" role="button" tabIndex={0} onClick={() => setMenuOpen((o) => !o)}>
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
                <Link to="/wallet" onClick={() => setMenuOpen(false)}>
                  👛 Wallet
                </Link>
                <Link to="/refer" onClick={() => setMenuOpen(false)}>
                  🎁 Refer & earn
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
                {!user.isOrganizer && !user.isPromoter && !user.isLineup && (
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
