import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, ORGANIZERS, PAST_EVENTS, REVIEWS } from '../data/mock';
import { friendsAtEvents } from '../lib/social';
import FriendsProof from '../components/FriendsProof';
import Poster from '../components/Poster';
import EventCard from '../components/EventCard';
import Stars from '../components/Stars';

export default function OrganizerProfile() {
  const { id } = useParams();
  const { following, toggleFollow } = useApp();
  const org = ORGANIZERS.find((o) => o.id === id);

  if (!org) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Organizer not found</h1>
          <Link to="/" className="btn btn-pri" style={{ marginTop: 18 }}>
            Home
          </Link>
        </div>
      </main>
    );
  }

  const upcoming = EVENTS.filter((e) => e.organizerId === org.id && e.status === 'approved');
  const isFollowing = following.includes(org.id);
  const friends = friendsAtEvents(upcoming.map((e) => e.id), following);

  return (
    <main className="page">
      <div className="container">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}>
          <Poster hue={org.logoHue} emoji="🎧" variant="square" className="" />
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ fontSize: 24 }}>
              {org.brandName} {org.verified && <span className="verified">✓</span>}
            </h1>
            <div className="muted small">
              @{org.username} · {org.city} · since {org.since}
            </div>
            <p className="muted small" style={{ marginTop: 6, maxWidth: 480 }}>
              {org.about}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="icon-round">ig</span>
            <span className="icon-round">x</span>
            <span className="icon-round">🌐</span>
            <button
              className={`btn btn-sm ${isFollowing ? 'btn-ghost' : 'btn-pri'}`}
              onClick={() => toggleFollow(org.id)}
            >
              {isFollowing ? 'Following ✓' : '+ Follow'}
            </button>
            <button className="btn btn-ghost btn-sm">⇪ Share</button>
          </div>
        </div>

        <FriendsProof people={friends} suffix="going to their events" style={{ marginBottom: 16 }} />

        <div className="profile-grid">
          <div>
            <div className="stat3" style={{ marginBottom: 16 }}>
              <div className="s">
                <div className="v">{(org.followers / 1000).toFixed(1).replace('.0', '')}k</div>
                <div className="l">followers</div>
              </div>
              <div className="s">
                <div className="v">{org.following}</div>
                <div className="l">following</div>
              </div>
              <div className="s">
                <div className="v">{org.eventsHosted}</div>
                <div className="l">events hosted</div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 8 }}>Verified organizer</h3>
              <div className="kv">
                <span className="k">Identity KYC</span>
                <span className="verified">✓</span>
              </div>
              <div className="kv">
                <span className="k">Bank verified</span>
                <span className="verified">✓</span>
              </div>
              <div className="kv">
                <span className="k">Joined</span>
                <span>Jan {org.since}</span>
              </div>
            </div>
          </div>

          <div>
            <section className="section" style={{ marginTop: 0 }}>
              <div className="section-hd">
                <h2>Upcoming events ({upcoming.length})</h2>
              </div>
              {upcoming.length ? (
                <div className="grid-3">
                  {upcoming.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              ) : (
                <div className="empty">No upcoming events published.</div>
              )}
            </section>

            <section className="section">
              <div className="section-hd">
                <h2>Past events ({org.eventsHosted})</h2>
              </div>
              <div className="grid-3">
                {PAST_EVENTS.slice(0, 6).map((p) => (
                  <div key={p.title} className="ecard">
                    <Poster hue={p.hue} emoji="📸" label="poster" />
                    <div>
                      <h3>{p.title}</h3>
                      <div className="meta">
                        {p.date} · ★ {p.orgRating}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="section">
              <div className="section-hd">
                <h2>Rating & reviews</h2>
              </div>
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 26, fontWeight: 800 }}>{org.rating}</span>
                  <Stars rating={org.rating} />
                  <span className="muted small">· {org.reviewCount} reviews</span>
                </div>
                {REVIEWS.map((r) => (
                  <div key={r.id} className="review">
                    <span className="bold">{r.author}</span> · <Stars rating={r.rating} /> ·{' '}
                    <span className="muted-2">{r.eventTitle}</span>
                    <div className="muted">“{r.text}”</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}
