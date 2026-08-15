import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, fmtTime } from '../../data/mock';
import PromoteCard from '../../components/PromoteCard';
import Loader from '../../components/Loader';
import { venuePartner } from '../../api';
import { ApiError } from '../../api/client';
import type { Event, Venue } from '../../types';

/** Real venue overview — GET /venue/listing + GET /venue/events. */
export default function VenueDashboard() {
  const [venue, setVenue] = useState<(Venue & { favourites: number }) | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    Promise.all([venuePartner.myListing(), venuePartner.events()])
      .then(([v, evs]) => {
        setVenue(v);
        setEvents(evs);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load dashboard'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader />;
  if (err || !venue) return <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err || 'Listing not found'}</div>;

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.date).getTime() >= now).sort((a, b) => a.date.localeCompare(b.date));
  const past = events.filter((e) => new Date(e.date).getTime() < now);

  const checklist = [
    { t: 'Listing details complete', done: Boolean(venue.about && venue.capacity > 0) },
    { t: 'Amenities added', done: venue.amenities.length > 0 },
    { t: 'Verification', done: venue.verified },
    { t: 'First event hosted', done: events.length > 0 },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24 }}>{venue.name} 🏛</h1>
        {venue.verified ? (
          <span className="badge badge-ok">Verified ✓</span>
        ) : (
          <Link to="/venue/settings/verification" className="btn btn-pri btn-sm">Complete verification →</Link>
        )}
      </div>
      <p className="muted small" style={{ margin: '4px 0 18px' }}>
        {venue.type} · {venue.city} · capacity {venue.capacity}
      </p>

      <div className="grid-3" style={{ marginBottom: 18 }}>
        <div className="card center">
          <div style={{ fontSize: 26, fontWeight: 800 }}>{upcoming.length}</div>
          <div className="tiny muted">Upcoming events</div>
        </div>
        <div className="card center">
          <div style={{ fontSize: 26, fontWeight: 800 }}>{past.length}</div>
          <div className="tiny muted">Events hosted</div>
        </div>
        <div className="card center">
          <div style={{ fontSize: 26, fontWeight: 800 }}>{venue.followers + venue.favourites}</div>
          <div className="tiny muted">Followers & favourites</div>
        </div>
      </div>

      <PromoteCard type="venue" refId={venue.id} city={venue.city} label="your venue" />

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 10 }}>Listing checklist</h3>
        {checklist.map((c) => (
          <div key={c.t} className="kv">
            <span className="k">{c.done ? '✅' : '◻️'} {c.t}</span>
            {!c.done && c.t === 'Verification' && <span className="tiny muted-2">admin review in progress</span>}
          </div>
        ))}
        <div style={{ display: 'flex', gap: 10, marginTop: 12, flexWrap: 'wrap' }}>
          <Link to="/venue/listing" className="btn btn-pri btn-sm">Edit my listing →</Link>
          <Link to={`/venues/${venue.id}`} className="btn btn-ghost btn-sm">View public page ↗</Link>
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 10 }}>Next up at your venue</h3>
        {upcoming.length === 0 ? (
          <div className="muted small">
            No upcoming events yet. Organizers pick venues while creating events — a complete, verified listing gets
            chosen more. <Link to="/venue/listing" className="link">Polish your listing →</Link>
          </div>
        ) : (
          upcoming.slice(0, 5).map((e) => (
            <div key={e.id} className="evrow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="bold small">{e.title}</div>
                <div className="tiny muted-2">{fmtDate(e.date)} · {fmtTime(e.date)} · {e.category}</div>
              </div>
              <Link to={`/events/${e.slug}`} className="btn btn-ghost btn-sm">View →</Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
