import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { EVENTS, FEATURED_PRICING, fmtDate, venueById } from '../../data/mock';
import PromoteCard from '../../components/PromoteCard';

const SALES = [42, 55, 38, 61, 74, 52, 68, 85, 62, 91, 78, 96, 84, 108];

export default function Dashboard() {
  const { myEvents, bookings } = useApp();
  const [topCity, setTopCity] = useState('All');
  // Everything on this dashboard is scoped to THIS organizer (LiveWire) only
  const orgEvents = [...myEvents, ...EVENTS.filter((e) => e.organizerId === 'livewire')];
  const live = orgEvents.filter((e) => e.status === 'approved');
  const orgEventIds = new Set(orgEvents.map((e) => e.id));
  const orgBookings = bookings.filter((b) => orgEventIds.has(b.eventId));
  const uniqueCustomers = new Set(orgBookings.map((b) => b.whatsapp)).size + 512;
  const cities = ['All', ...new Set(live.map((e) => venueById(e.venueId)?.city).filter(Boolean) as string[])];
  const topPool = live
    .map((e) => ({ ...e, soldTotal: e.tiers.reduce((a, t) => a + t.sold, 0), city: venueById(e.venueId)?.city ?? '' }))
    .filter((e) => e.soldTotal > 0 && (topCity === 'All' || e.city === topCity))
    .sort((a, b) => b.soldTotal - a.soldTotal)
    .slice(0, 5);
  const maxTop = Math.max(...topPool.map((e) => e.soldTotal), 1);
  const capAll = live.reduce((a, e) => a + e.tiers.reduce((x, t) => x + t.quantity, 0), 0);
  const soldAll = live.reduce((a, e) => a + e.tiers.reduce((x, t) => x + t.sold, 0), 0);
  const max = Math.max(...SALES);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
        <h1 style={{ fontSize: 24 }}>Dashboard</h1>
        <Link to="/organizer/events/create" className="btn btn-pri">
          + Create event
        </Link>
      </div>

      <div className="kpis" style={{ marginBottom: 14 }}>
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

      {/* Your totals — scoped to this organizer only */}
      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi">
          <div className="l">Your customers</div>
          <div className="v">{uniqueCustomers.toLocaleString()}</div>
        </div>
        <div className="kpi">
          <div className="l">Your events (all statuses)</div>
          <div className="v">{orgEvents.length}</div>
        </div>
        <div className="kpi">
          <div className="l">Your bookings</div>
          <div className="v">{(orgBookings.length + 1279).toLocaleString()}</div>
        </div>
      </div>

      <PromoteCard type="organizer" refId="livewire" city="Austin" label="your brand" monthly={FEATURED_PRICING.organizerMonthly} />

      {/* Top selling events with city filter */}
      <div className="card" style={{ marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
          <h3>Top selling events</h3>
          <div className="chip-row">
            {cities.map((c) => (
              <button key={c} className={`chip ${topCity === c ? 'on' : ''}`} style={{ fontSize: 11, padding: '3px 11px' }} onClick={() => setTopCity(c)}>
                {c}
              </button>
            ))}
          </div>
        </div>
        {topPool.length ? (
          topPool.map((e) => (
            <div key={e.id} style={{ marginBottom: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                <span className="bold">{e.title}</span>
                <span className="muted small">{e.soldTotal.toLocaleString()} sold · {e.city}</span>
              </div>
              <div className="bar" style={{ marginTop: 4 }}>
                <div style={{ width: `${(e.soldTotal / maxTop) * 100}%` }} />
              </div>
            </div>
          ))
        ) : (
          <div className="muted small">No sales in {topCity} yet.</div>
        )}
      </div>

      {/* Ticket statistics */}
      <div className="card" style={{ marginBottom: 18 }}>
        <h3 style={{ marginBottom: 4 }}>Ticket statistics</h3>
        <div className="tiny muted-2" style={{ marginBottom: 10 }}>
          across your {live.length} live events · capacity {capAll.toLocaleString()}
        </div>
        {(
          [
            ['Sold', soldAll, 'var(--accent)'],
            ['Available', Math.max(0, capAll - soldAll), 'rgba(155,225,61,.35)'],
            ['Checked in', Math.round(soldAll * 0.42), '#8ab4f8'],
            ['Refunded', Math.round(soldAll * 0.02), 'var(--danger)'],
          ] as [string, number, string][]
        ).map(([label, v, color]) => (
          <div key={label} style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
              <span>{label}</span>
              <span className="bold">{v.toLocaleString()}</span>
            </div>
            <div className="bar" style={{ marginTop: 3 }}>
              <div style={{ width: `${(v / Math.max(soldAll, capAll - soldAll, 1)) * 100}%`, background: color }} />
            </div>
          </div>
        ))}
        <div className="tiny muted-2">
          sell-through {capAll ? Math.round((soldAll / capAll) * 100) : 0}% · check-in rate 42%
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
