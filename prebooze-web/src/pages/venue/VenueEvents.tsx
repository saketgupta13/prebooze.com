import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { EVENTS, fmtDate, fmtTime, organizerById } from '../../data/mock';

/** Every event hosted (or booked to happen) at this venue. */
export default function VenueEvents() {
  const { user, myEvents } = useApp();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');

  const here = [...EVENTS, ...myEvents].filter((e) => e.venueId === user?.venueId && e.status === 'approved');
  const now = Date.now();
  const list = (tab === 'upcoming'
    ? here.filter((e) => new Date(e.date).getTime() >= now)
    : here.filter((e) => new Date(e.date).getTime() < now)
  ).sort((a, b) => (tab === 'upcoming' ? a.date.localeCompare(b.date) : b.date.localeCompare(a.date)));

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Events at your venue</h1>
      <p className="muted small" style={{ marginBottom: 14 }}>
        Organizers book your venue through their event flow — every approved event shows up here automatically.
      </p>
      <div className="tabs" style={{ marginBottom: 14 }}>
        <button className={tab === 'upcoming' ? 'on' : ''} onClick={() => setTab('upcoming')}>Upcoming</button>
        <button className={tab === 'past' ? 'on' : ''} onClick={() => setTab('past')}>Past</button>
      </div>

      {list.length === 0 ? (
        <div className="empty">
          No {tab} events at this venue{tab === 'upcoming' ? ' yet — a complete, verified listing gets picked more often' : ''}.
        </div>
      ) : (
        list.map((e) => {
          const org = organizerById(e.organizerId);
          const sold = e.tiers.reduce((s, t) => s + t.sold, 0);
          const total = e.tiers.reduce((s, t) => s + t.quantity, 0);
          return (
            <div key={e.id} className="card" style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="bold">{e.title}</div>
                <div className="tiny muted-2" style={{ marginTop: 3 }}>
                  {fmtDate(e.date)} · {fmtTime(e.date)} · {e.category}
                  {org && <> · by {org.brandName}</>}
                </div>
              </div>
              <div className="small muted" style={{ minWidth: 110 }}>
                🎟 {sold}/{total} sold
                {sold >= total && total > 0 && <span className="accent bold"> · sold out</span>}
              </div>
              <Link to={`/events/${e.slug}`} className="btn btn-ghost btn-sm">View event →</Link>
            </div>
          );
        })
      )}
    </div>
  );
}
