import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { EVENT_STATUS, Kpi, Tag } from '../components/ui';

const TREND = [42, 55, 38, 61, 74, 52, 68, 85, 62, 91, 78, 96, 84, 108];

export default function Dashboard() {
  const { events, bookings, organizers } = useAdmin();
  const navigate = useNavigate();

  const pendingEvents = events.filter((e) => e.status === 'pending').length;
  const pendingRefunds = bookings.filter((b) => b.status === 'refund_requested').length;
  const pendingKyc = organizers.filter((o) => o.status === 'pending').length;
  const max = Math.max(...TREND);

  return (
    <div className="stack fade" style={{ maxWidth: 1200, gap: 16 }}>
      <div className="page-hd">
        <h1 className="display" style={{ fontSize: 22 }}>Good morning, Admin 👋</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="chip">Last 7 days ▾</span>
          <Link to="/organizers/new" className="btn btn-pri btn-sm">+ Add organizer</Link>
        </div>
      </div>

      <div className="kpi-grid">
        <Kpi label="Gross sales" value="₹4.2L" delta="▲ 12% vs last wk" deltaColor="var(--green)" />
        <Kpi label="Tickets sold" value="1,842" delta="▲ 8%" deltaColor="var(--green)" />
        <Kpi label="Commission earned" value="₹38.4k" delta="▲ 15%" deltaColor="var(--green)" />
        <Kpi label="Refunds" value="₹6.1k" delta="▼ 41 tickets" deltaColor="var(--red)" alert />
      </div>

      <div className="two-col">
        <div className="card">
          <div className="display" style={{ marginBottom: 8, fontWeight: 700 }}>Sales trend</div>
          <div className="tiny muted" style={{ marginBottom: 8 }}>daily sales vs commission · last 14 days</div>
          <div className="bars" style={{ height: 110 }}>
            {TREND.map((v, i) => (
              <div key={i} className="bar">
                <div style={{ height: `${(v / max) * 100}%`, opacity: 0.35 + (v / max) * 0.65 }} title={`₹${v}k`} />
              </div>
            ))}
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
