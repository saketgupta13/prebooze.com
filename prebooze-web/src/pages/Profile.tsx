import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { fmtDate } from '../data/mock';
import { catalog, bookings as bookingsApi } from '../api';
import type { Booking, Organizer, Venue } from '../types';
import Poster from '../components/Poster';
import ShareButton from '../components/ShareButton';

export default function Profile() {
  const { user, following, toggleFollow, updateUser, followers, followersLoading, favVenues, toggleFavVenue, wishlist } = useApp();

  const [liveBookings, setLiveBookings] = useState<Booking[]>([]);
  const [bookingsLoading, setBookingsLoading] = useState(true);
  const [followedOrgs, setFollowedOrgs] = useState<Organizer[]>([]);
  const [favVenueDetails, setFavVenueDetails] = useState<Venue[]>([]);

  useEffect(() => {
    bookingsApi.list().then(setLiveBookings).catch(() => setLiveBookings([])).finally(() => setBookingsLoading(false));
  }, []);

  // organizer follow keys are bare ids (no "type:" prefix) — every other
  // followable kind (venue/promoter/lineup/person) is prefixed. See
  // OrganizerProfile.tsx's own toggleFollow(org.id) call for the same convention.
  const organizerIds = following.filter((k) => !k.includes(':'));
  useEffect(() => {
    if (organizerIds.length === 0) { setFollowedOrgs([]); return; }
    Promise.all(organizerIds.map((id) => catalog.organizer(id).catch(() => null)))
      .then((rows) => setFollowedOrgs(rows.filter((o): o is Organizer => !!o)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizerIds.join(',')]);

  useEffect(() => {
    if (favVenues.length === 0) { setFavVenueDetails([]); return; }
    Promise.all(favVenues.map((id) => catalog.venue(id).catch(() => null)))
      .then((rows) => setFavVenueDetails(rows.filter((v): v is Venue => !!v)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [favVenues.join(',')]);

  if (!user) return null;

  const visibility = user.attendanceVisibility ?? 'off';
  const peopleFollowing = following.filter((f) => f.startsWith('person:')).length;
  const VIS_OPTIONS: { v: 'off' | 'followers' | 'public'; label: string; desc: string }[] = [
    { v: 'off', label: 'Off', desc: 'Nobody sees you' },
    { v: 'followers', label: 'Followers', desc: 'People who follow you' },
    { v: 'public', label: 'Public', desc: 'Anyone on Prebooze' },
  ];

  const now = Date.now();
  const confirmed = liveBookings.filter((b) => b.status === 'confirmed' && b.event);
  const upcoming = confirmed.filter((b) => new Date(b.event!.date).getTime() > now);
  const attended = confirmed.filter((b) => new Date(b.event!.date).getTime() <= now);

  return (
    <main className="page">
      <div className="container profile-grid">
        {/* Left column */}
        <div>
          <div className="card center" style={{ marginBottom: 16 }}>
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt="" className="avatar" style={{ width: 74, height: 74, objectFit: 'cover', margin: '0 auto 12px' }} />
            ) : (
              <span className="avatar" style={{ width: 74, height: 74, fontSize: 32, margin: '0 auto 12px' }}>
                👤
              </span>
            )}
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
              <div className="muted small rich-text" style={{ marginBottom: 10 }} dangerouslySetInnerHTML={{ __html: user.bio }} />
            )}
            <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
              <Link to="/profile/edit" className="btn btn-ghost btn-sm">
                ✎ Edit
              </Link>
              <ShareButton path={user.username ? `/u/${user.username}` : '/people'} label="⇪ Share profile" />
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
                // ID verification is paused platform-wide for now (no live
                // KYC vendor key yet) — not linked to /verify-id so guests
                // aren't prompted into a check that isn't really live.
                // Booking was never gated on this either way.
                <span className="badge badge-pending">Paused</span>
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

          {!user.profileRewardClaimedAt && (
            <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent)' }}>
              <h3 style={{ marginBottom: 4 }}>🎁 Get 10% off your next booking</h3>
              <p className="tiny muted-2" style={{ marginBottom: 10 }}>
                Finish your profile — photo, bio, interests — and get a one-time 10% off code (up to ₹100).
              </p>
              <Link to="/finish-profile" className="btn btn-pri btn-sm">Complete your profile →</Link>
            </div>
          )}

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
              <div className="v">{attended.length}</div>
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
              <h3>Favourite venues ({favVenueDetails.length})</h3>
              <Link to="/wishlist" className="link tiny bold">❤️ Wishlist ({wishlist.length}) →</Link>
            </div>
            {favVenueDetails.length === 0 ? (
              <div className="muted small">Tap 🤍 on any <Link to="/venues" className="link">venue</Link> to save it here.</div>
            ) : (
              favVenueDetails.map((v) => (
                <div key={v.id} className="kv" style={{ alignItems: 'center' }}>
                  <Link to={`/venues/${v.id}`} className="k bold" style={{ color: 'var(--text)' }}>
                    🏛 {v.name} <span className="muted" style={{ fontWeight: 400 }}>· {v.city}</span>
                  </Link>
                  <button className="btn btn-ghost btn-sm" onClick={() => toggleFavVenue(v.id)}>❤️ Saved</button>
                </div>
              ))
            )}
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <h3 style={{ marginBottom: 8 }}>Followers ({followers.length})</h3>
            {followersLoading ? (
              <div className="muted small">Loading…</div>
            ) : followers.length === 0 ? (
              <div className="muted small">No followers yet.</div>
            ) : (
              followers.map((p) => (
                <Link key={p.id} to={`/u/${p.username}`} className="kv" style={{ alignItems: 'center', textDecoration: 'none', color: 'inherit' }}>
                  <span className="k bold" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    {p.avatarUrl ? (
                      <img src={p.avatarUrl} alt="" style={{ width: 28, height: 28, borderRadius: '50%', objectFit: 'cover' }} />
                    ) : (
                      <span style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${p.avatarHue} 55% 45%)`, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12 }}>
                        {p.name[0]}
                      </span>
                    )}
                    {p.name} {p.verified && <span className="verified">✓</span>}
                  </span>
                </Link>
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
            {bookingsLoading ? (
              <div className="tiny muted">Loading…</div>
            ) : upcoming.length === 0 ? (
              <div className="empty">
                Nothing booked yet —{' '}
                <Link to="/browse" className="link">
                  find your next night out →
                </Link>
              </div>
            ) : (
              <div className="grid-3">
                {upcoming.map((b) => (
                  <div key={b.id} className="ecard">
                    <Poster hue={b.event!.posterHue} emoji="🎟" label="poster" imageUrl={b.event!.posterUrl} alt={b.event!.title} />
                    <div>
                      <h3>{b.event!.title}</h3>
                      <div className="meta">{fmtDate(b.event!.date)}</div>
                      <Link to="/bookings" className="link small bold">
                        View ticket →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <div className="section-hd">
              <h2>Events attended ({attended.length})</h2>
              <Link to="/bookings">See all bookings →</Link>
            </div>
            {!bookingsLoading && attended.length === 0 ? (
              <div className="empty">No past events yet.</div>
            ) : (
              <div className="grid-3">
                {attended.slice(0, 6).map((b) => (
                  <div key={b.id} className="ecard">
                    <Poster hue={b.event!.posterHue} emoji="📸" label="poster" imageUrl={b.event!.posterUrl} alt={b.event!.title} />
                    <div>
                      <h3>{b.event!.title}</h3>
                      <div className="meta">{fmtDate(b.event!.date)}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
