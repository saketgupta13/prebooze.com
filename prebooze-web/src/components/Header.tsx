import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { CITIES } from '../data/mock';

export default function Header() {
  const { user, city, setCity, logout } = useApp();
  const navigate = useNavigate();
  const [cityOpen, setCityOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [q, setQ] = useState('');

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

        <button className="hdr-city" onClick={() => setCityOpen((o) => !o)}>
          📍 {city} ▾
          {cityOpen && (
            <div className="menu">
              {CITIES.map((c) => (
                <button
                  key={c}
                  onClick={(e) => {
                    e.stopPropagation();
                    setCity(c);
                    setCityOpen(false);
                  }}
                >
                  {c === city ? '✓ ' : ''}
                  {c}
                </button>
              ))}
            </div>
          )}
        </button>

        <span className="hdr-spacer" />

        <nav className="hdr-links">
          <Link to="/browse">Events</Link>
          <Link to="/venues">Venues</Link>
          <Link to="/blog">Blog</Link>
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
