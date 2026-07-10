import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { ORGANIZERS, PAST_EVENTS, eventById } from '../data/mock';
import { fmtDate } from '../data/mock';
import Poster from '../components/Poster';
import Stars from '../components/Stars';

export default function Profile() {
  const { user, bookings, following, toggleFollow, myEvents } = useApp();

  if (!user) return null;

  const upcoming = bookings.filter((b) => {
    const ev = eventById(b.eventId) ?? myEvents.find((e) => e.id === b.eventId);
    return ev && b.status === 'confirmed' && new Date(ev.date).getTime() > Date.now();
  });
  const followedOrgs = ORGANIZERS.filter((o) => following.includes(o.id));

  return (
    <main className="page">
      <div className="container profile-grid">
        {/* Left column */}
        <div>
          <div className="card center" style={{ marginBottom: 16 }}>
            <span className="avatar" style={{ width: 74, height: 74, fontSize: 32, margin: '0 auto 12px' }}>
              👤
            </span>
            <h1 style={{ fontSize: 21 }}>
              {user.name || 'New guest'} {user.idVerified && <span className="verified">✓</span>}
            </h1>
            <div className="muted small" style={{ marginBottom: 10 }}>
              {user.username ? `@${user.username} · ` : ''}
              {user.city}
            </div>
            {user.bio && (
              <p className="muted small" style={{ marginBottom: 10 }}>
                {user.bio}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Link to="/profile/edit" className="btn btn-ghost btn-sm">
                ✎ Edit
              </Link>
              <button className="btn btn-ghost btn-sm">⇪ Share profile</button>
            </div>
          </div>

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 8 }}>Verification status</h3>
            <div className="kv">
              <span className="k">Phone number</span>
              <span className="badge badge-ok">Verified ✓</span>
            </div>
            <div className="kv">
              <span className="k">Government ID</span>
              {user.idVerified ? (
                <span className="badge badge-ok">Verified ✓</span>
              ) : (
                <Link to="/verify-id" className="link small bold">
                  Verify now →
                </Link>
              )}
            </div>
            <div className="kv">
              <span className="k">Profile status</span>
              <span>{user.profilePct}% complete</span>
            </div>
            <div className="kv">
              <span className="k">Joined</span>
              <span>{user.joined}</span>
            </div>
          </div>

          <div className="stat3" style={{ marginBottom: 16 }}>
            <div className="s">
              <div className="v">{bookings.length}</div>
              <div className="l">parties attended</div>
            </div>
            <div className="s">
              <div className="v">{user.isOrganizer ? myEvents.length : 0}</div>
              <div className="l">parties hosted</div>
            </div>
            <div className="s">
              <div className="v">{following.length}</div>
              <div className="l">following</div>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 8 }}>Following ({followedOrgs.length})</h3>
            {followedOrgs.length === 0 && (
              <div className="muted small">Follow organizers to see their next events first.</div>
            )}
            {followedOrgs.map((o) => (
              <div key={o.id} className="kv">
                <Link to={`/organizers/${o.id}`} className="k bold" style={{ color: 'var(--text)' }}>
                  {o.brandName} {o.verified && <span className="verified">✓</span>}
                </Link>
                <button className="btn btn-ghost btn-sm" onClick={() => toggleFollow(o.id)}>
                  Following ✓
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div>
          <section className="section" style={{ marginTop: 0 }}>
            <div className="section-hd">
              <h2>Upcoming events ({upcoming.length})</h2>
            </div>
            {upcoming.length === 0 ? (
              <div className="empty">
                Nothing booked yet —{' '}
                <Link to="/browse" className="link">
                  find your next night out →
                </Link>
              </div>
            ) : (
              <div className="grid-3">
                {upcoming.map((b) => {
                  const ev = eventById(b.eventId) ?? myEvents.find((e) => e.id === b.eventId);
                  if (!ev) return null;
                  return (
                    <div key={b.id} className="ecard">
                      <Poster hue={ev.posterHue} emoji="🎟" label="poster" />
                      <div>
                        <h3>{ev.title}</h3>
                        <div className="meta">{fmtDate(ev.date)}</div>
                        <Link to="/bookings" className="link small bold">
                          View ticket →
                        </Link>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </section>

          <section className="section">
            <div className="section-hd">
              <h2>Events attended ({PAST_EVENTS.length})</h2>
              <a href="#all">Show all past events →</a>
            </div>
            <div className="grid-3">
              {PAST_EVENTS.slice(0, 6).map((p) => (
                <div key={p.title} className="ecard">
                  <Poster hue={p.hue} emoji="📸" label="poster" />
                  <div>
                    <h3>{p.title}</h3>
                    <div className="meta">
                      {p.date} ·{' '}
                      {p.rating > 0 ? <Stars rating={p.rating} /> : <span className="link">rate ▾</span>}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
