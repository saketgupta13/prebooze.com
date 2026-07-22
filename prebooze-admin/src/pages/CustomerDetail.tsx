import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { BOOKING_STATUS, CUSTOMER_STATUS, Kpi, Tag } from '../components/ui';

/** Full customer detail — profile, KPIs and real booking history, matched
 * by guest name (the same key the mock's own booking records use — there's
 * no shared customer id on a booking, this mirrors how the old drawer's
 * "View bookings" link already searched). */
export default function CustomerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { customers, bookings, events, toggleBlockCustomer, removeCustomer, toast } = useAdmin();

  const customer = customers.find((c) => c.id === id);
  if (!customer) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Customer not found</h1>
        <Link to="/customers" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Customers</Link>
      </div>
    );
  }

  const eventTitle = (eventId: string) => events.find((e) => e.id === eventId)?.title ?? '';
  const history = bookings.filter((b) => b.guest.toLowerCase() === customer.name.toLowerCase());
  const totalPaid = history.filter((b) => b.status !== 'refunded').reduce((a, b) => a + b.amount, 0);

  return (
    <div className="stack fade" style={{ maxWidth: 800, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/customers" style={{ fontSize: 13 }}>← Customers</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{customer.name} {customer.verified && '✓'}</h1>
        <Tag {...CUSTOMER_STATUS[customer.status]} />
        <div style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={() => toast('Opening WhatsApp chat…')}>💬 WhatsApp</button>
        <button className="btn btn-danger btn-sm" onClick={() => toggleBlockCustomer(customer.id)}>
          {customer.status === 'blocked' ? 'Unblock customer' : 'Block customer'}
        </button>
      </div>
      <div className="small muted">
        {customer.city} · {customer.gender}
        {customer.phone && <> · {customer.phone}</>}
        {customer.email && <> · {customer.email}</>}
      </div>

      <div className="kpi-grid">
        <Kpi label="Bookings" value={customer.bookings || history.length} />
        <Kpi label="Total spend" value={`₹${fmt(customer.spend)}`} />
        <Kpi label="Paid on record" value={`₹${fmt(totalPaid)}`} />
        <Kpi label="Status" value={CUSTOMER_STATUS[customer.status].label} />
      </div>

      {customer.notes && (
        <div className="card">
          <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Notes</div>
          <div className="small muted">{customer.notes}</div>
        </div>
      )}

      <div className="tblwrap">
        <div className="display" style={{ fontWeight: 700, padding: '10px 14px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          Booking history
        </div>
        <div className="thead" style={{ minWidth: 520 }}>
          <span style={{ flex: 1 }}>#ID</span>
          <span style={{ flex: 1.8 }}>Event</span>
          <span style={{ flex: 1 }}>Qty · Amount</span>
          <span style={{ flex: 1 }}>Status</span>
        </div>
        {history.map((b) => (
          <div key={b.id} className="trow clickable" style={{ minWidth: 520 }} onClick={() => navigate(`/bookings/${encodeURIComponent(b.id)}`)}>
            <span style={{ flex: 1, fontWeight: 700 }}>{b.id}</span>
            <span style={{ flex: 1.8 }} className="muted">{eventTitle(b.eventId)}</span>
            <span style={{ flex: 1 }}>{b.qty} · ₹{fmt(b.amount)}</span>
            <span style={{ flex: 1 }}><Tag {...BOOKING_STATUS[b.status]} /></span>
          </div>
        ))}
        {history.length === 0 && <div className="trow muted">No bookings on record for this name yet.</div>}
      </div>
      <div className="tiny hint">click a booking row to open its full detail, fee breakdown and refund actions</div>

      <button
        className="btn btn-danger btn-sm"
        style={{ width: 'fit-content' }}
        onClick={() => {
          if (window.confirm(`Permanently remove ${customer.name}? Their bookings stay on record.`)) {
            removeCustomer(customer.id);
            navigate('/customers');
          }
        }}
      >
        ✕ Remove customer
      </button>
    </div>
  );
}
