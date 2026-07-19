import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { EVENTS, FEATURED_PRICING, VENUES, fmtDate, fmtTime } from '../../data/mock';
import PromoteCard from '../../components/PromoteCard';

/** Venue overview — verification status, listing health and events at a glance. */
export default function VenueDashboard() {
  const { user, myEvents } = useApp();
  const venue = VENUES.find((v) => v.id === user?.venueId);

  const here = [...EVENTS, ...myEvents].filter((e) => e.venueId === user?.venueId && e.status === 'approved');
  const now = Date.now();
  const upcoming = here.filter((e) => new Date(e.date).getTime() >= now).sort((a, b) => a.date.localeCompare(b.date));
  const past = here.filter((e) => new Date(e.date).getTime() < now);

  const checklist = [
    { t: 'Listing details complete', done: Boolean(venue?.about && venue.capacity > 0) },
    { t: 'Amenities added', done: (venue?.amenities.length ?? 0) > 0 },
    { t: 'Verification', done: Boolean(venue?.verified) },
    { t: 'First event hosted', done: here.length > 0 },
  ];

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24 }}>{venue?.name ?? user?.venueName ?? 'Your venue'} 🏛</h1>
        {venue?.verified ? (
          <span className="badge badge-ok">Verified ✓</span>
        ) : (
          <span className="badge badge-pending">Pending review ◌ · ~24h</span>
        )}
      </div>
      <p className="muted small" style={{ margin: '4px 0 18px' }}>
        {venue ? `${venue.type} · ${venue.city} · capacity ${venue.capacity}` : 'Complete your listing to appear in the directory.'}
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
          <div style={{ fontSize: 26, fontWeight: 800 }}>{venue?.followers ?? 0}</div>
          <div className="tiny muted">Followers & favourites</div>
        </div>
      </div>

      {venue && (
        <PromoteCard type="venue" refId={venue.id} city={venue.city} label="your venue" monthly={FEATURED_PRICING.venueMonthly} />
      )}

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
          {venue && <Link to={`/venues/${venue.id}`} className="btn btn-ghost btn-sm">View public page ↗</Link>}
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
