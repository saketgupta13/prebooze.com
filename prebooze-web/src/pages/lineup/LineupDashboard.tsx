import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { EVENTS, fmtDate, fmtTime, lineupBySlug, venueById } from '../../data/mock';
import PromoteCard from '../../components/PromoteCard';

export default function LineupDashboard() {
  const { user } = useApp();
  const name = user?.lineupName ?? 'artist';
  const slug = user?.lineupUsername ?? '';
  const seed = lineupBySlug(slug);
  const city = seed?.city ?? user?.city ?? 'Austin';

  // events this artist is tagged in (line-up includes their stage name)
  const tagged = EVENTS.filter((e) => e.lineup.some((l) => l.name.toLowerCase() === name.toLowerCase()));

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 18, flexWrap: 'wrap', gap: 8 }}>
        <h1 style={{ fontSize: 24 }}>Hey, {name} 🎤</h1>
        <span className="badge badge-pending">Pending admin review ◌</span>
      </div>

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi"><div className="l">Category</div><div className="v">{user?.lineupCategory ?? '—'}</div></div>
        <div className="kpi"><div className="l">Based in</div><div className="v">{city}</div></div>
        <div className="kpi"><div className="l">Tagged in</div><div className="v">{tagged.length}<span className="muted small"> events</span></div></div>
      </div>

      {slug && (
        <PromoteCard type="lineup" refId={slug} city={city} label="your artist profile" />
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          <h3>Events you're tagged in</h3>
          {seed && <Link to={`/lineup/${slug}`} className="btn btn-ghost btn-sm">View public profile →</Link>}
        </div>
        {tagged.length === 0 ? (
          <div className="muted small">You’re not on any line-ups yet. Organizers add you to their events — they’ll appear here.</div>
        ) : (
          tagged.map((e) => {
            const venue = venueById(e.venueId);
            const me = e.lineup.find((l) => l.name.toLowerCase() === name.toLowerCase());
            return (
              <Link key={e.id} to={`/events/${e.slug}`} className="evrow" style={{ textDecoration: 'none', color: 'inherit' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bold small">{e.title} <span className="muted" style={{ fontWeight: 400 }}>· {me?.role}</span></div>
                  <div className="tiny muted-2">{fmtDate(e.date)} · {fmtTime(e.date)} · {venue?.name}, {venue?.city}</div>
                </div>
                <span className="link small">View →</span>
              </Link>
            );
          })
        )}
      </div>
    </div>
  );
}
