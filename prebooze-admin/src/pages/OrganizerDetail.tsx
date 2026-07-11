import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { Kpi, ORGANIZER_STATUS, Tag } from '../components/ui';

const MONTH_BARS = [30, 55, 40, 70, 85, 60];
const MONTH_LABELS = ['Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'];

export default function OrganizerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { organizers, events, toast } = useAdmin();

  const org = organizers.find((o) => o.id === id);
  if (!org) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Organizer not found</h1>
        <Link to="/organizers" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Organizers</Link>
      </div>
    );
  }

  // KPIs, chart and income table computed from this organizer's own event records
  const orgEvents = events.filter((e) => e.organizer === org.name);
  const lifetime = orgEvents.reduce((a, e) => a + e.revenue, 0);
  const commissionPaid = orgEvents.reduce((a, e) => a + (e.revenue * (e.commission ?? 0)) / 100, 0);
  const maxBar = Math.max(...MONTH_BARS);

  return (
    <div className="stack fade" style={{ maxWidth: 1000, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/organizers" style={{ fontSize: 13 }}>← Organizers</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{org.name}</h1>
        <Tag {...ORGANIZER_STATUS[org.status]} />
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => toast('Message sent to organizer ✓')}>
          Message organizer
        </button>
        <Link to={`/organizers/${org.id}/edit`} className="btn btn-pri btn-sm">✎ Edit organizer</Link>
      </div>
      <div className="small muted">
        {org.contact} · {org.city} · joined Jan '25 ·{' '}
        {orgEvents[0]?.commission != null ? `${orgEvents[0].commission}% commission deal` : 'commission set per event'}
      </div>

      <div className="kpi-grid">
        <Kpi label="Lifetime revenue" value={`₹${fmt(lifetime)}`} />
        <Kpi label="Commission paid" value={`₹${fmt(commissionPaid)}`} />
        <Kpi label="Net payouts" value={`₹${fmt(lifetime - commissionPaid)}`} />
        <Kpi label="Events run" value={org.events || orgEvents.length} />
      </div>

      <div className="card">
        <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Income over time</div>
        <div className="bars">
          {MONTH_BARS.map((v, i) => (
            <div key={i} className="bar">
              <div style={{ height: `${Math.round((v / maxBar) * 100)}%` }} />
              <span>{MONTH_LABELS[i]}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="tblwrap">
        <div className="display" style={{ fontWeight: 700, padding: '10px 14px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          Income by event
        </div>
        <div className="thead" style={{ minWidth: 520 }}>
          <span style={{ flex: 2 }}>Event</span>
          <span style={{ flex: 1 }}>Sold</span>
          <span style={{ flex: 1 }}>Gross</span>
          <span style={{ flex: 1 }}>Commission</span>
          <span style={{ flex: 1 }}>Net</span>
        </div>
        {orgEvents.map((ev) => {
          const c = ev.commission ?? 0;
          const commAmt = (ev.revenue * c) / 100;
          return (
            <div key={ev.id} className="trow clickable" style={{ minWidth: 520 }} onClick={() => navigate(`/events/${ev.id}`)}>
              <span style={{ flex: 2, fontWeight: 700 }}>{ev.title}</span>
              <span style={{ flex: 1 }}>{fmt(ev.sold)}/{fmt(ev.cap)}</span>
              <span style={{ flex: 1 }}>₹{fmt(ev.revenue)}</span>
              <span style={{ flex: 1 }}>₹{fmt(commAmt)} ({c}%)</span>
              <span style={{ flex: 1, fontWeight: 700 }} className="green">₹{fmt(ev.revenue - commAmt)}</span>
            </div>
          );
        })}
        {orgEvents.length === 0 && <div className="trow muted">No events yet for this organizer.</div>}
      </div>
      <div className="tiny hint">click an event row to open its editor · full history exportable as CSV</div>
    </div>
  );
}
