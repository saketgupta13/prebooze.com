import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, VENUES } from '../data/mock';
import Poster from '../components/Poster';
import EventCard from '../components/EventCard';

export default function VenueDetail() {
  const { id } = useParams();
  const { following, toggleFollow } = useApp();
  const venue = VENUES.find((v) => v.id === id);

  if (!venue) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Venue not found</h1>
          <Link to="/venues" className="btn btn-pri" style={{ marginTop: 18 }}>
            All venues
          </Link>
        </div>
      </main>
    );
  }

  const events = EVENTS.filter((e) => e.venueId === venue.id && e.status === 'approved');
  const followKey = 'venue:' + venue.id;
  const isFollowing = following.includes(followKey);

  return (
    <main className="page">
      <div className="container">
        <Poster hue={venue.photoHue} emoji="🏛" label="venue photo 1 of 6 — image slider" variant="landscape" />

        <div style={{ display: 'flex', gap: 18, alignItems: 'center', margin: '22px 0', flexWrap: 'wrap' }}>
          <span className="avatar" style={{ width: 58, height: 58, fontSize: 24 }}>🏛</span>
          <div style={{ flex: 1, minWidth: 200 }}>
            <h1 style={{ fontSize: 24 }}>
              {venue.name} {venue.verified && <span className="verified">✓</span>}
            </h1>
            <div className="muted small">
              {venue.type} · {venue.locality} · followed by guests & hosts · {venue.followers}{' '}
              followers
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="icon-round">ig</span>
            <span className="icon-round">x</span>
            <span className="icon-round">🌐</span>
            <button
              className={`btn btn-sm ${isFollowing ? 'btn-ghost' : 'btn-pri'}`}
              onClick={() => toggleFollow(followKey)}
            >
              {isFollowing ? 'Following ✓' : '+ Follow'}
            </button>
            <button className="btn btn-ghost btn-sm">⇪ Share</button>
          </div>
        </div>

        <div className="stat3" style={{ maxWidth: 520, marginBottom: 24 }}>
          <div className="s">
            <div className="v">{events.length || 3}</div>
            <div className="l">upcoming</div>
          </div>
          <div className="s">
            <div className="v">{venue.capacity.toLocaleString()}</div>
            <div className="l">capacity</div>
          </div>
          <div className="s">
            <div className="v">★ {venue.rating}</div>
            <div className="l">rating</div>
          </div>
        </div>

        <div className="grid-2" style={{ alignItems: 'stretch', marginBottom: 10 }}>
          <div className="card">
            <div
              style={{
                borderRadius: 10,
                border: '1.5px dashed var(--border-dash)',
                padding: '34px 10px',
                textAlign: 'center',
                color: 'var(--muted-2)',
                marginBottom: 12,
              }}
            >
              📍 google map embed
            </div>
            <div className="small muted">{venue.address}</div>
            <a href="#directions" className="link small bold">
              Get directions →
            </a>
          </div>
          <div className="card">
            <h3 style={{ marginBottom: 10 }}>Amenities</h3>
            <div className="chip-row" style={{ marginBottom: 16 }}>
              {venue.amenities.map((a) => (
                <span key={a} className="chip static">
                  {a}
                </span>
              ))}
            </div>
            <h3 style={{ marginBottom: 8 }}>About this venue</h3>
            <p className="muted small">{venue.about}</p>
          </div>
        </div>

        <section className="section">
          <div className="section-hd">
            <h2>
              Events happening at {venue.name} ({events.length})
            </h2>
            <Link to="/browse">See all events →</Link>
          </div>
          {events.length ? (
            <div className="grid-4">
              {events.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          ) : (
            <div className="empty">No published events here right now.</div>
          )}
        </section>
      </div>
    </main>
  );
}
