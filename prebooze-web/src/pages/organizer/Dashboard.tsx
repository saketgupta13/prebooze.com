import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { EVENTS, fmtDate } from '../../data/mock';

const SALES = [42, 55, 38, 61, 74, 52, 68, 85, 62, 91, 78, 96, 84, 108];

export default function Dashboard() {
  const { myEvents } = useApp();
  const live = [...myEvents.filter((e) => e.status === 'approved'), ...EVENTS.filter((e) => e.organizerId === 'livewire' && e.status === 'approved')];
  const max = Math.max(...SALES);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 style={{ fontSize: 24 }}>Dashboard</h1>
        <Link to="/organizer/events/create" className="btn btn-pri">
          + Create event
        </Link>
      </div>

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi">
          <div className="l">Tickets sold (30d)</div>
          <div className="v">1,284</div>
        </div>
        <div className="kpi">
          <div className="l">Revenue</div>
          <div className="v">₹38.2k</div>
        </div>
        <div className="kpi">
          <div className="l">Live events</div>
          <div className="v">{live.length}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 4 }}>Sales over time</h3>
        <div className="muted tiny">last 14 days · tickets/day</div>
        <div className="chart">
          {SALES.map((v, i) => (
            <div key={i} className="col" style={{ height: `${(v / max) * 100}%` }} title={`${v} tickets`} />
          ))}
        </div>
      </div>

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Upcoming events</h3>
        {live.slice(0, 4).map((e) => {
          const sold = e.tiers.reduce((a, t) => a + t.sold, 0);
          const cap = e.tiers.reduce((a, t) => a + t.quantity, 0);
          return (
            <div key={e.id} className="evrow">
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="bold small">
                  {e.title} <span className="muted">· {fmtDate(e.date)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
                  <div className="bar">
                    <div style={{ width: `${cap ? (sold / cap) * 100 : 0}%` }} />
                  </div>
                  <span className="tiny muted" style={{ whiteSpace: 'nowrap' }}>
                    {sold.toLocaleString()} / {cap.toLocaleString()} sold
                  </span>
                </div>
              </div>
              <Link to="/organizer/attendees" className="btn btn-ghost btn-sm">
                Attendees →
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
