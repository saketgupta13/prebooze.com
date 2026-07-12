import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { EVENT_STATUS, Kpi, Tag } from '../components/ui';

const RANGES: Record<string, number[]> = {
  'Last 7 days': [68, 85, 62, 91, 78, 96, 108],
  'Last 14 days': [42, 55, 38, 61, 74, 52, 68, 85, 62, 91, 78, 96, 84, 108],
  'Last 30 days': [31, 44, 39, 52, 47, 61, 42, 55, 38, 61, 74, 52, 68, 85, 62, 91, 78, 96, 84, 108, 92, 88, 74, 101, 96, 112, 89, 118, 104, 121],
  'This month': [52, 68, 85, 62, 91, 78, 96, 84, 108, 92, 88, 74],
  'Last quarter': [280, 342, 310, 398, 371, 452, 429, 486, 512, 471, 538, 502, 561],
};

function dayLabels(n: number, quarterly: boolean) {
  const out: string[] = [];
  const d = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const dt = new Date(d);
    if (quarterly) dt.setDate(d.getDate() - i * 7);
    else dt.setDate(d.getDate() - i);
    out.push(dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }));
  }
  return out;
}

export default function Dashboard() {
  const { events, bookings, organizers, customers } = useAdmin();
  const navigate = useNavigate();

  const pendingEvents = events.filter((e) => e.status === 'pending').length;
  const pendingRefunds = bookings.filter((b) => b.status === 'refund_requested').length;
  const pendingKyc = organizers.filter((o) => o.status === 'pending').length;
  const [range, setRange] = useState('Last 14 days');
  const [topCity, setTopCity] = useState('All');
  const trend = RANGES[range];
  const max = Math.max(...trend);
  const labels = dayLabels(trend.length, range === 'Last quarter');
  const labelEvery = Math.max(1, Math.ceil(trend.length / 7));

  return (
    <div className="stack fade" style={{ maxWidth: 1200, gap: 16 }}>
      <div className="page-hd">
        <h1 className="display" style={{ fontSize: 22 }}>Good morning, Admin 👋</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <select className="chip" style={{ appearance: 'none', cursor: 'pointer', background: 'var(--bg)' }} value={range} onChange={(e) => setRange(e.target.value)}>
            {Object.keys(RANGES).map((r) => (
              <option key={r}>{r}</option>
            ))}
          </select>
          <Link to="/organizers/new" className="btn btn-pri btn-sm">+ Add organizer</Link>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi label="Gross sales" value="₹4.2L" delta="▲ 12% vs last wk" deltaColor="var(--green)" />
        <Kpi label="Tickets sold" value="1,842" delta="▲ 8%" deltaColor="var(--green)" />
        <Kpi label="Commission earned" value="₹38.4k" delta="▲ 15%" deltaColor="var(--green)" />
        <Kpi label="Refunds" value="₹6.1k" delta="▼ 41 tickets" deltaColor="var(--red)" alert />
      </div>

      {/* Platform totals */}
      <div className="kpi-grid">
        <Kpi label="Total customers" value={fmt(customers.filter((c) => c.segment === 'guests').length + 2140)} delta="registered guests" deltaColor="var(--muted)" />
        <Kpi label="Total organizers" value={organizers.length} delta={`${organizers.filter((o) => o.status === 'approved').length} approved`} deltaColor="var(--muted)" />
        <Kpi label="Total events" value={events.length} delta={`${events.filter((e) => e.status === 'live').length} live now`} deltaColor="var(--muted)" />
        <Kpi label="Total bookings" value={fmt(bookings.length + 1838)} delta={`${bookings.filter((b) => b.status === 'refund_requested').length} refund requests`} deltaColor="var(--muted)" />
      </div>

      <div className="two-col">
        <div className="card">
          <div className="display" style={{ marginBottom: 2, fontWeight: 700 }}>Sales trend</div>
          <div className="tiny muted" style={{ marginBottom: 8 }}>
            {range === 'Last quarter' ? 'weekly' : 'daily'} gross sales (₹ thousands) · {range.toLowerCase()}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            {/* Y axis */}
            <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', height: 220, textAlign: 'right', paddingBottom: 0 }} className="tiny muted">
              <span>₹{max}k</span>
              <span>₹{Math.round((max * 3) / 4)}k</span>
              <span>₹{Math.round(max / 2)}k</span>
              <span>₹{Math.round(max / 4)}k</span>
              <span>₹0</span>
            </div>
            <div style={{ flex: 1, borderLeft: '1px solid rgba(139,195,74,.25)', borderBottom: '1px solid rgba(139,195,74,.25)', paddingLeft: 4 }}>
              <div className="bars" style={{ height: 218 }}>
                {trend.map((v, i) => (
                  <div key={i} className="bar">
                    <div style={{ height: `${(v / max) * 100}%`, opacity: 0.35 + (v / max) * 0.65 }} title={`${labels[i]} — ₹${v}k`} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          {/* X axis */}
          <div style={{ display: 'flex', gap: 8, paddingLeft: 38 }}>
            <div style={{ flex: 1, display: 'flex' }} className="tiny muted">
              {trend.map((_, i) => (
                <span key={i} style={{ flex: 1, textAlign: 'center', overflow: 'visible', whiteSpace: 'nowrap', fontSize: 9 }}>
                  {i % labelEvery === 0 ? labels[i] : ''}
                </span>
              ))}
            </div>
          </div>
        </div>

        <div className="card" style={{ borderColor: 'rgba(255,107,94,.3)', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="display" style={{ fontWeight: 700, color: 'var(--red)' }}>Needs attention</div>
          <button
            className="dashed-box"
            style={{ borderColor: 'rgba(255,107,94,.4)', color: 'var(--red-soft)', background: 'none', textAlign: 'left', fontSize: 12 }}
            onClick={() => navigate('/events?tab=pending')}
          >
            ⚠ {pendingEvents} event{pendingEvents === 1 ? '' : 's'} awaiting approval →
          </button>
          <button
            className="dashed-box"
            style={{ background: 'none', textAlign: 'left', fontSize: 12 }}
            onClick={() => navigate('/bookings?status=refund_requested')}
          >
            ↩ {pendingRefunds} refund request{pendingRefunds === 1 ? '' : 's'} pending →
          </button>
          <button
            className="dashed-box"
            style={{ borderColor: 'rgba(139,195,74,.5)', color: 'var(--green)', background: 'none', textAlign: 'left', fontSize: 12 }}
            onClick={() => navigate('/events/e1/live')}
          >
            ● Indie Night Live is live now — open gate monitor →
          </button>
          <div className="dashed-box" style={{ fontSize: 12 }}>💸 2 organizer payouts due Fri</div>
          <button
            className="dashed-box"
            style={{ background: 'none', textAlign: 'left', fontSize: 12 }}
            onClick={() => navigate('/organizers')}
          >
            🛡 {pendingKyc} organizer KYC to review →
          </button>
        </div>
      </div>

      <div className="two-col">
        {/* Top selling events with city filter */}
        <div className="card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
            <span className="display" style={{ fontWeight: 700 }}>Top selling events</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {['All', ...new Set(events.map((e) => e.city))].map((c) => (
                <button key={c} className={`chip ${topCity === c ? 'on' : ''}`} style={{ fontSize: 10.5, padding: '3px 10px' }} onClick={() => setTopCity(c)}>
                  {c}
                </button>
              ))}
            </div>
          </div>
          {(() => {
            const pool = events
              .filter((e) => e.sold > 0 && (topCity === 'All' || e.city === topCity))
              .sort((a, b) => b.sold - a.sold)
              .slice(0, 5);
            const maxSold = Math.max(...pool.map((e) => e.sold), 1);
            return pool.length ? (
              <div className="stack" style={{ gap: 8 }}>
                {pool.map((e) => (
                  <div key={e.id} style={{ cursor: 'pointer' }} onClick={() => navigate(`/events/${e.id}`)}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <b>{e.title}</b>
                      <span className="muted">{fmt(e.sold)} sold · {e.city}</span>
                    </div>
                    <div style={{ height: 8, background: 'rgba(139,195,74,.12)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                      <div style={{ width: `${(e.sold / maxSold) * 100}%`, height: '100%', background: 'var(--green)', opacity: 0.5 + (e.sold / maxSold) * 0.5 }} />
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="muted small">No selling events in {topCity} yet.</div>
            );
          })()}
        </div>

        {/* Ticket statistics */}
        <div className="card">
          <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Ticket statistics</div>
          {(() => {
            const selling = events.filter((e) => e.status !== 'draft');
            const cap = selling.reduce((a, e) => a + e.cap, 0);
            const sold = selling.reduce((a, e) => a + e.sold, 0);
            const checkedIn = bookings.filter((b) => b.status === 'checked_in').reduce((a, b) => a + b.qty, 0) + 246;
            const refunded = bookings.filter((b) => b.status === 'refunded').reduce((a, b) => a + b.qty, 0) + 39;
            const rows: [string, number, string][] = [
              ['Sold', sold, 'var(--green)'],
              ['Available', Math.max(0, cap - sold), 'rgba(139,195,74,.35)'],
              ['Checked in', checkedIn, '#8ab4f8'],
              ['Refunded', refunded, 'var(--red)'],
            ];
            const maxV = Math.max(...rows.map((r) => r[1]), 1);
            return (
              <div className="stack" style={{ gap: 8 }}>
                <div className="tiny muted">across {selling.length} published events · capacity {fmt(cap)}</div>
                {rows.map(([label, v, color]) => (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                      <span>{label}</span>
                      <b>{fmt(v)}</b>
                    </div>
                    <div style={{ height: 8, background: 'rgba(241,243,234,.06)', borderRadius: 4, overflow: 'hidden', marginTop: 3 }}>
                      <div style={{ width: `${(v / maxV) * 100}%`, height: '100%', background: color }} />
                    </div>
                  </div>
                ))}
                <div className="tiny hint">sell-through {cap ? Math.round((sold / cap) * 100) : 0}% · check-in rate {sold ? Math.round((checkedIn / sold) * 100) : 0}%</div>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="tblwrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          <span className="display" style={{ fontWeight: 700 }}>Live &amp; upcoming events</span>
          <Link to="/events" className="small">All events →</Link>
        </div>
        <div className="thead" style={{ minWidth: 560 }}>
          <span style={{ flex: 2 }}>Event</span>
          <span style={{ flex: 1 }}>Date</span>
          <span style={{ flex: 1 }}>Sold</span>
          <span style={{ flex: 1 }}>Revenue</span>
          <span style={{ flex: 1 }}>Status</span>
        </div>
        {events.slice(0, 3).map((ev) => {
          const sm = EVENT_STATUS[ev.status];
          return (
            <div key={ev.id} className="trow clickable" style={{ minWidth: 560 }} onClick={() => navigate(`/events/${ev.id}`)}>
              <span style={{ flex: 2, fontWeight: 700 }}>{ev.title}</span>
              <span style={{ flex: 1 }} className="muted">{ev.date}</span>
              <span style={{ flex: 1 }}>{ev.status === 'pending' ? '—' : `${fmt(ev.sold)}/${fmt(ev.cap)}`}</span>
              <span style={{ flex: 1 }}>{ev.status === 'pending' ? '—' : `₹${fmt(ev.revenue)}`}</span>
              <span style={{ flex: 1 }}><Tag {...sm} /></span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
