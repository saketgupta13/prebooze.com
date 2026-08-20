import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { fmtDate, fmtTime } from '../../data/mock';
import { useApp } from '../../store/AppContext';
import { venuePartner } from '../../api';
import { ApiError } from '../../api/client';
import type { Event } from '../../types';
import { eventCity, eventPath } from '../../lib/urls';

/** Every event hosted at this venue — real GET /venue/events (already scoped
 * to approved events at this venue, organizer embedded). */
export default function VenueEvents() {
  const { city } = useApp();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    venuePartner
      .events()
      .then(setEvents)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load events'))
      .finally(() => setLoading(false));
  }, []);

  const now = Date.now();
  const list = (tab === 'upcoming'
    ? events.filter((e) => new Date(e.date).getTime() >= now)
    : events.filter((e) => new Date(e.date).getTime() < now)
  ).sort((a, b) => (tab === 'upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Events at your venue</h1>
      <p className="muted small" style={{ marginBottom: 14 }}>
        Organizers book your venue through their event flow — every approved event shows up here automatically.
      </p>
      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}
      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={tab === 'upcoming' ? 'on' : ''} onClick={() => setTab('upcoming')}>Upcoming</button>
        <button className={tab === 'past' ? 'on' : ''} onClick={() => setTab('past')}>Past</button>
      </div>

      {loading && <div className="muted small">Loading…</div>}
      {!loading && list.length === 0 && (
        <div className="empty">
          No {tab} events at this venue{tab === 'upcoming' ? ' yet — a complete, verified listing gets picked more often' : ''}.
        </div>
      )}
      {list.map((e) => {
        const sold = e.tiers.reduce((s, t) => s + t.sold, 0);
        const total = e.tiers.reduce((s, t) => s + t.quantity, 0);
        return (
          <div key={e.id} className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="bold">{e.title}</div>
              <div className="tiny muted-2" style={{ marginTop: 3 }}>
                {fmtDate(e.date)} · {fmtTime(e.date)} · {e.category}
                {e.organizer && <> · by {e.organizer.brandName}</>}
              </div>
            </div>
            <div className="small muted" style={{ minWidth: 110 }}>
              🎟 {sold}/{total} sold
              {sold >= total && total > 0 && <span className="accent bold"> · sold out</span>}
            </div>
            <Link to={eventPath(eventCity(e) ?? city, e.slug)} className="btn btn-ghost btn-sm">View event →</Link>
          </div>
        );
      })}
    </div>
  );
}
