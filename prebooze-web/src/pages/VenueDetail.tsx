import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, VENUES } from '../data/mock';
import Poster from '../components/Poster';
import ShareButton from '../components/ShareButton';
import EventCard from '../components/EventCard';

export default function VenueDetail() {
  const { id } = useParams();
  const { following, toggleFollow, favVenues, toggleFavVenue } = useApp();
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
        {(() => {
          const labels = ['main hall', 'stage', 'bar', 'entry', 'crowd', 'terrace'];
          return <VenueSlider hue={venue.photoHue} labels={labels} />;
        })()}

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
              className="btn btn-ghost btn-sm"
              title={favVenues.includes(venue.id) ? 'Remove favourite' : 'Favourite this venue'}
              onClick={() => toggleFavVenue(venue.id)}
            >
              {favVenues.includes(venue.id) ? '❤️ Favourited' : '🤍 Favourite'}
            </button>
            <button
              className={`btn btn-sm ${isFollowing ? 'btn-ghost' : 'btn-pri'}`}
              onClick={() => toggleFollow(followKey)}
            >
              {isFollowing ? 'Following ✓' : '+ Follow'}
            </button>
            <ShareButton path={`/venues/${venue.id}`} />
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
            <iframe
              title={`Map — ${venue.name}`}
              src={`https://maps.google.com/maps?q=${encodeURIComponent(`${venue.name}, ${venue.address}, ${venue.city}`)}&z=15&output=embed`}
              style={{ width: '100%', height: 200, border: '1px solid var(--border)', borderRadius: 10, marginBottom: 12 }}
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
            />
            <div className="small muted" style={{ marginBottom: 10 }}>📍 {venue.address}, {venue.city}</div>
            <a
              href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${venue.name}, ${venue.address}, ${venue.city}`)}`}
              target="_blank"
              rel="noreferrer"
              className="btn btn-pri btn-sm"
            >
              🧭 Get directions →
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


/** Image slider cycling all venue photos with ‹ › controls and dots. */
function VenueSlider({ hue, labels }: { hue: number; labels: string[] }) {
  const [idx, setIdx] = useState(0);
  const go = (d: number) => setIdx((i) => (i + d + labels.length) % labels.length);
  return (
    <div style={{ position: 'relative' }}>
      <Poster
        hue={(hue + idx * 40) % 360}
        emoji="🏛"
        label={`${labels[idx]} · photo ${idx + 1} of ${labels.length}`}
        variant="landscape"
      />
      <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(26,28,23,.75)' }} onClick={() => go(-1)}>
        ‹
      </button>
      <button className="btn btn-ghost btn-sm" style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', background: 'rgba(26,28,23,.75)' }} onClick={() => go(1)}>
        ›
      </button>
      <div style={{ position: 'absolute', bottom: 10, left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: 6 }}>
        {labels.map((_, i) => (
          <button
            key={i}
            aria-label={`photo ${i + 1}`}
            onClick={() => setIdx(i)}
            style={{ width: 8, height: 8, borderRadius: '50%', border: 'none', cursor: 'pointer', background: i === idx ? 'var(--accent)' : 'rgba(237,239,230,.35)' }}
          />
        ))}
      </div>
    </div>
  );
}
