import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { SearchBox, Tag } from '../components/ui';
import { downloadCsv } from '../lib/csv';
import { liveBookings, liveCarts, LiveApiError, type LiveBooking, type LiveCart } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Bookings';
type FilterKey = 'all' | LiveBooking['status'];

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'refund_requested', label: 'Refunds' },
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'refunded', label: 'Refunded' },
  { key: 'cancelled', label: 'Cancelled' },
];

const STATUS_TAG: Record<LiveBooking['status'], { label: string; cls: string }> = {
  refund_requested: { label: 'Refund req.', cls: 'tag-red' },
  confirmed: { label: 'Confirmed', cls: 'tag-green' },
  refunded: { label: 'Refunded', cls: 'tag-dim' },
  cancelled: { label: 'Cancelled', cls: '' },
};

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/** Real bookings + refund queue — the mock's fee-breakdown/QR/refund drawer
 * moved to BookingDetail.tsx, this stays the searchable list + the abandoned
 * carts by event panel (now from the real CartsService, same as
 * AbandonedCarts.tsx). */
export default function Bookings() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('status') as FilterKey) ?? 'all';
  const [query, setQuery] = useState(params.get('q') ?? '');

  const [bookings, setBookings] = useState<LiveBooking[]>([]);
  const [carts, setCarts] = useState<LiveCart[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveBookings.list(), liveCarts.list()])
      .then(([b, c]) => {
        setBookings(b);
        setCarts(c);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Landing on plain /bookings with no search and no explicit "view all"
  // shows the event-grouped summary first (name/date/count/revenue) rather
  // than every booking ever made flattened into one table — typing a
  // search or clicking into a specific event both fall through to the same
  // underlying booking-list view below, just scoped differently.
  const showingSummary = !eventId && !query.trim() && params.get('view') !== 'all';

  const list = useMemo(() => {
    let l = eventId ? bookings.filter((b) => b.event.id === eventId) : bookings;
    if (filter !== 'all') l = l.filter((b) => b.status === filter);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((b) => b.id.toLowerCase().includes(q) || b.mainGuest.toLowerCase().includes(q) || b.whatsapp.includes(q));
    }
    return l;
  }, [bookings, eventId, filter, query]);

  const scopedEvent = eventId ? bookings.find((b) => b.event.id === eventId)?.event : undefined;

  const eventsSummary = useMemo(() => {
    const m = new Map<string, { title: string; date: string; count: number; qty: number; revenue: number }>();
    bookings.forEach((b) => {
      const cur = m.get(b.event.id) ?? { title: b.event.title, date: b.event.date, count: 0, qty: 0, revenue: 0 };
      cur.count += 1;
      cur.qty += b.qty;
      if (b.status === 'confirmed' || b.status === 'refund_requested') cur.revenue += b.total;
      m.set(b.event.id, cur);
    });
    return [...m.entries()].sort((a, b) => a[1].date.localeCompare(b[1].date));
  }, [bookings]);

  const cartsByEvent = useMemo(() => {
    const m = new Map<string, { title: string; count: number; value: number }>();
    carts.forEach((c) => {
      const cur = m.get(c.eventId) ?? { title: c.eventTitle, count: 0, value: 0 };
      cur.count += 1;
      cur.value += c.amount;
      m.set(c.eventId, cur);
    });
    return [...m.entries()].sort((a, b) => b[1].value - a[1].value);
  }, [carts]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const exportCsv = () => {
    const rows: (string | number)[][] = [
      ['ID', 'Guest', 'Phone', 'Event', 'Qty', 'Amount', 'Status'],
      ...list.map((b) => [b.id, b.mainGuest, b.whatsapp, b.event.title, b.qty, b.total, b.status]),
    ];
    downloadCsv(`prebooze-bookings-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  const cartsTotalValue = carts.reduce((a, c) => a + c.amount, 0);

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      {eventId && <Link to="/bookings" style={{ fontSize: 13 }}>← All events</Link>}
      <div className="page-hd">
        <h1 className="page-title">{eventId ? (scopedEvent?.title ?? 'Bookings') : 'Bookings'}</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          {!showingSummary && <button className="btn btn-ghost" onClick={exportCsv}>⬇ Export CSV</button>}
          <Link to="/bookings/new" className="btn btn-pri">+ Manual booking</Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBox value={query} onChange={setQuery} placeholder="booking id / phone / name…" style={{ flex: 1, minWidth: 180 }} />
        {!eventId && !query.trim() && (
          <Link to={showingSummary ? '/bookings?view=all' : '/bookings'} className={`chip ${!showingSummary ? 'on' : ''}`}>
            {showingSummary ? '📋 All bookings' : '← Back to events'}
          </Link>
        )}
        {!showingSummary && FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip ${filter === f.key ? 'on' : ''}`}
            onClick={() => setParams(f.key === 'all' ? {} : { status: f.key })}
          >
            {f.label}
          </button>
        ))}
      </div>

      {showingSummary ? (
        <div className="tblwrap">
          <div className="thead" style={{ minWidth: 480 }}>
            <span style={{ flex: 2 }}>Event</span>
            <span style={{ flex: 1 }}>Date</span>
            <span style={{ flex: 1 }}>Bookings</span>
            <span style={{ flex: 1 }}>Revenue</span>
          </div>
          {eventsSummary.map(([id, v]) => (
            <div key={id} className="trow clickable" style={{ minWidth: 480 }} onClick={() => navigate(`/bookings/event/${encodeURIComponent(id)}`)}>
              <span style={{ flex: 2, fontWeight: 700 }}>{v.title}</span>
              <span style={{ flex: 1 }} className="muted small">{new Date(v.date).toLocaleDateString('en-IN')}</span>
              <span style={{ flex: 1 }}>{v.count} · {v.qty} tix</span>
              <span style={{ flex: 1 }} className="green">₹{fmt(v.revenue)}</span>
            </div>
          ))}
          {eventsSummary.length === 0 && !loading && <div className="trow muted">No bookings yet.</div>}
        </div>
      ) : (
        <>
          <div className="tblwrap">
            <div className="thead" style={{ minWidth: 560 }}>
              <span style={{ flex: 1 }}>#ID</span>
              <span style={{ flex: 1.6 }}>Guest</span>
              <span style={{ flex: 1.8 }}>Event</span>
              <span style={{ flex: 1 }}>Qty · Amount</span>
              <span style={{ flex: 1 }}>Status</span>
            </div>
            {list.map((b) => (
              <div
                key={b.id}
                className="trow clickable"
                style={{ minWidth: 560, background: b.status === 'refund_requested' ? 'rgba(255,107,94,.06)' : undefined }}
                onClick={() => navigate(`/bookings/${encodeURIComponent(b.id)}`)}
              >
                <span style={{ flex: 1, fontWeight: 700 }}>{b.id}</span>
                <span style={{ flex: 1.6 }}>{b.mainGuest} · {b.whatsapp}</span>
                <span style={{ flex: 1.8 }} className="muted">{b.event.title}</span>
                <span style={{ flex: 1 }}>{b.qty} · ₹{fmt(b.total)}</span>
                <span style={{ flex: 1 }}><Tag {...STATUS_TAG[b.status]} /></span>
              </div>
            ))}
            {list.length === 0 && !loading && <div className="trow muted">No bookings match.</div>}
          </div>
          <div className="tiny hint">Click a row for the fee breakdown, QR resend and refund actions.</div>
        </>
      )}

      {/* Abandoned carts — event-wise */}
      {cartsByEvent.length > 0 && (
        <div className="tblwrap">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)', flexWrap: 'wrap', gap: 6 }}>
            <span className="display" style={{ fontWeight: 700 }}>🛒 Abandoned carts by event</span>
            <span className="small muted">{carts.length} open · ₹{fmt(cartsTotalValue)} recoverable · <Link to="/abandoned">recover →</Link></span>
          </div>
          <div className="thead" style={{ minWidth: 480 }}>
            <span style={{ flex: 2 }}>Event</span>
            <span style={{ flex: 1 }}>Carts</span>
            <span style={{ flex: 1 }}>Recoverable</span>
          </div>
          {cartsByEvent.map(([id, v]) => (
            <Link key={id} to="/abandoned" className="trow clickable" style={{ minWidth: 480, textDecoration: 'none' }}>
              <span style={{ flex: 2, fontWeight: 700 }}>{v.title}</span>
              <span style={{ flex: 1 }}>{v.count}</span>
              <span style={{ flex: 1 }} className="green">₹{fmt(v.value)}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
