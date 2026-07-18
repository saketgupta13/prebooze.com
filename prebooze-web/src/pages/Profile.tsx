import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { ORGANIZERS, PAST_EVENTS, VENUES, eventById, personById } from '../data/mock';
import { fmtDate } from '../data/mock';
import Poster from '../components/Poster';
import Stars from '../components/Stars';

export default function Profile() {
  const { user, bookings, following, toggleFollow, myEvents, updateUser, followers, followRequests, acceptFollowRequest, declineFollowRequest, removeFollower, favVenues, toggleFavVenue, wishlist } = useApp();

  if (!user) return null;

  const visibility = user.attendanceVisibility ?? 'off';
  const peopleFollowing = following.filter((f) => f.startsWith('person:')).length;
  const followerPeople = followers.map((id) => personById(id)).filter((p): p is NonNullable<typeof p> => !!p);
  const VIS_OPTIONS: { v: 'off' | 'followers' | 'public'; label: string; desc: string }[] = [
    { v: 'off', label: 'Off', desc: 'Nobody sees you' },
    { v: 'followers', label: 'Followers', desc: 'People who follow you' },
    { v: 'public', label: 'Public', desc: 'Anyone on Prebooze' },
  ];

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
            <div className="muted small" style={{ marginBottom: 6 }}>
              {user.username ? `@${user.username} · ` : ''}
              {user.city}
            </div>
            <div className="small" style={{ marginBottom: 10 }}>
              <b>{followers.length}</b> <span className="muted">followers</span> · <b>{peopleFollowing}</b> <span className="muted">following</span>
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

          {followRequests.length > 0 && (
            <div className="card" style={{ marginBottom: 16 }}>
              <h3 style={{ marginBottom: 8 }}>
                Follow requests <span className="badge badge-pending">{followRequests.length}</span>
              </h3>
              {followRequests.map((id) => {
                const p = personById(id);
                if (!p) return null;
                return (
                  <div key={id} className="kv" style={{ alignItems: 'center' }}>
                    <Link to={`/u/${p.username}`} className="k bold" style={{ color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${p.avatarHue} 55% 45%)`, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                        {p.name[0]}
                      </span>
                      {p.name} {p.verified && <span className="verified">✓</span>}
                    </Link>
                    <span style={{ display: 'flex', gap: 6 }}>
                      <button className="btn btn-pri btn-sm" onClick={() => acceptFollowRequest(id)}>Accept</button>
                      <button className="btn btn-ghost btn-sm" onClick={() => declineFollowRequest(id)}>Decline</button>
                    </span>
                  </div>
                );
              })}
              <div className="tiny muted-2" style={{ marginTop: 8 }}>
                once you accept, they can see the events you’re <b>going</b> to &amp; <b>interested</b> in
                {visibility === 'off' ? ' — set visibility to Followers below to share' : ''}
              </div>
            </div>
          )}

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

          <div className="card" style={{ marginBottom: 16 }}>
            <h3 style={{ marginBottom: 4 }}>Who's going — privacy</h3>
            <p className="tiny muted-2" style={{ marginBottom: 10 }}>Choose who can see the events you're attending. Off by default.</p>
            <div style={{ display: 'grid', gap: 6 }}>
              {VIS_OPTIONS.map((o) => {
                const cur = visibility === o.v;
                return (
                  <button
                    key={o.v}
                    className={`btn btn-sm ${cur ? 'btn-pri' : 'btn-ghost'}`}
                    style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}
                    onClick={() => updateUser({ attendanceVisibility: o.v })}
                  >
                    <span>{cur ? '✓ ' : ''}{o.label}</span>
                    <span className="tiny" style={{ opacity: 0.75, fontWeight: 400 }}>{o.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="stat3" style={{ marginBottom: 16 }}>
            <div className="s">
              <div className="v">{bookings.length}</div>
              <div className="l">attended</div>
            </div>
            <div className="s">
              <div className="v">{followers.length}</div>
              <div className="l">followers</div>
            </div>
            <div className="s">
              <div className="v">{peopleFollowing}</div>
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

          <div className="card" style={{ marginTop: 16 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <h3>Favourite venues ({favVenues.length})</h3>
              <Link to="/wishlist" className="link tiny bold">❤️ Wishlist ({wishlist.length}) →</Link>
            </div>
            {favVenues.length === 0 ? (
              <div className="muted small">Tap 🤍 on any <Link to="/venues" className="link">venue</Link> to save it here.</div>
            ) : (
              favVenues.map((id) => {
                const v = VENUES.find((x) => x.id === id);
                if (!v) return null;
                return (
                  <div key={id} className="kv" style={{ alignItems: 'center' }}>
                    <Link to={`/venues/${v.id}`} className="k bold" style={{ color: 'var(--text)' }}>
                      🏛 {v.name} <span className="muted" style={{ fontWeight: 400 }}>· {v.city}</span>
                    </Link>
                    <button className="btn btn-ghost btn-sm" onClick={() => toggleFavVenue(id)}>❤️ Saved</button>
                  </div>
                );
              })
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 8 }}>Followers ({followers.length})</h3>
            {followerPeople.length === 0 ? (
              <div className="muted small">No followers yet. Accept follow requests to grow your circle.</div>
            ) : (
              followerPeople.map((p) => (
                <div key={p.id} className="kv" style={{ alignItems: 'center' }}>
                  <Link to={`/u/${p.username}`} className="k bold" style={{ color: 'var(--text)', display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${p.avatarHue} 55% 45%)`, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                      {p.name[0]}
                    </span>
                    {p.name} {p.verified && <span className="verified">✓</span>}
                  </Link>
                  <button className="btn btn-ghost btn-sm" onClick={() => removeFollower(p.id)}>Remove</button>
                </div>
              ))
            )}
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
