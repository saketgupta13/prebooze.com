import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CUSTOMER_STATUS, Kpi, Tag } from '../components/ui';
import { liveCustomers, liveBookings, LiveApiError, type LiveCustomer, type LiveBooking } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';

const TITLE = 'Customer detail';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const STATUS_TAG: Record<LiveBooking['status'], { label: string; cls: string }> = {
  refund_requested: { label: 'Refund req.', cls: 'tag-red' },
  confirmed: { label: 'Confirmed', cls: 'tag-green' },
  refunded: { label: 'Refunded', cls: 'tag-dim' },
  cancelled: { label: 'Cancelled', cls: '' },
};
const waLink = (phone: string, message: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

/** Full customer detail — profile, KPIs and real booking history, matched
 * by the real userId a Booking actually carries (not a name-matching
 * hack). */
export default function CustomerDetail() {
  const { id } = useParams();
  const session = useLiveSession();
  const { token } = session;

  const [customers, setCustomers] = useState<LiveCustomer[]>([]);
  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveCustomers.list(), liveBookings.list()])
      .then(([c, b]) => {
        setCustomers(c);
        setBookings(b);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const customer = customers.find((c) => c.id === id);
  const history = useMemo(
    () => (customer ? bookings.filter((b) => b.userId === customer.id) : []),
    [bookings, customer],
  );

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  if (!loading && !customer) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Customer not found</h1>
        <Link to="/customers" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Customers</Link>
      </div>
    );
  }
  if (!customer) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const toggleBlocked = async () => {
    try {
      await liveCustomers.setBlocked(customer.id, customer.status !== 'blocked');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update');
    }
  };

  const totalPaid = history.filter((b) => b.status !== 'refunded').reduce((a, b) => a + b.total, 0);

  return (
    <div className="stack fade" style={{ maxWidth: 800, gap: 14 }}>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/customers" style={{ fontSize: 13 }}>← Customers</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{customer.name} {customer.verified && '✓'}</h1>
        <Tag {...CUSTOMER_STATUS[customer.status]} />
        <div style={{ flex: 1 }} />
        {customer.phone ? (
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => window.open(waLink(customer.phone, `Hey ${customer.name.split(' ')[0]}, this is the Prebooze team 👋`), '_blank', 'noopener')}
          >
            💬 WhatsApp
          </button>
        ) : (
          <button className="btn btn-ghost btn-sm" disabled title="No phone number on file">💬 WhatsApp</button>
        )}
        <button className="btn btn-danger btn-sm" onClick={toggleBlocked}>
          {customer.status === 'blocked' ? 'Unblock customer' : 'Block customer'}
        </button>
      </div>
      <div className="small muted">
        {customer.city || '—'} · {customer.gender || '—'}
        {customer.phone && <> · {customer.phone}</>}
        {customer.email && <> · {customer.email}</>}
      </div>

      <div className="kpi-grid">
        <Kpi label="Bookings" value={customer.bookings || history.length} />
        <Kpi label="Total spend" value={`₹${fmt(customer.spend)}`} />
        <Kpi label="Paid on record" value={`₹${fmt(totalPaid)}`} />
        <Kpi label="Status" value={CUSTOMER_STATUS[customer.status].label} />
      </div>

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
          <Link key={b.id} to={`/bookings/${encodeURIComponent(b.id)}`} className="trow clickable" style={{ minWidth: 520, textDecoration: 'none' }}>
            <span style={{ flex: 1, fontWeight: 700 }}>{b.id}</span>
            <span style={{ flex: 1.8 }} className="muted">{b.event.title}</span>
            <span style={{ flex: 1 }}>{b.qty} · ₹{fmt(b.total)}</span>
            <span style={{ flex: 1 }}><Tag {...STATUS_TAG[b.status]} /></span>
          </Link>
        ))}
        {history.length === 0 && !loading && <div className="trow muted">No bookings on record yet.</div>}
      </div>
      <div className="tiny hint">click a booking row to open its full detail, fee breakdown and refund actions</div>
    </div>
  );
}
