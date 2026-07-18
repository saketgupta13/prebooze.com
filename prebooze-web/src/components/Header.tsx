import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import CityPicker from './CityPicker';

export default function Header() {
  const { user, city, logout } = useApp();
  const navigate = useNavigate();
  const [cityOpen, setCityOpen] = useState(false);
  const [autoDetect, setAutoDetect] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState('');

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

        <button className="hdr-city" onClick={() => { setAutoDetect(false); setCityOpen(true); }}>
          📍 {city} ▾
        </button>
        <CityPicker open={cityOpen} onClose={() => setCityOpen(false)} autoDetect={autoDetect} />

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
