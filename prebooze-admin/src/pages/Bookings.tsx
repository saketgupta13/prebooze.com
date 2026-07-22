import { useMemo, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { BOOKING_STATUS, SearchBox, Tag } from '../components/ui';
import type { BookingStatus } from '../types';

type FilterKey = 'all' | BookingStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'refund_requested', label: 'Refunds' },
  { key: 'paid', label: 'Paid' },
  { key: 'checked_in', label: 'Checked in' },
];

export default function Bookings() {
  const { bookings, events, abandonedCarts, toast } = useAdmin();
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('status') as FilterKey) ?? 'all';
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [cityF, setCityF] = useState('All');
  const cities = ['All', ...new Set(events.map((e) => e.city))];
  const eventCity = (id: string) => events.find((e) => e.id === id)?.city ?? '';

  const eventTitle = (id: string) => events.find((e) => e.id === id)?.title ?? '';

  const list = useMemo(() => {
    let l = bookings;
    if (filter !== 'all') l = l.filter((b) => b.status === filter);
    if (cityF !== 'All') l = l.filter((b) => eventCity(b.eventId) === cityF);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((b) => b.id.toLowerCase().includes(q) || b.guest.toLowerCase().includes(q) || b.phone.includes(q));
    }
    return l;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, filter, cityF, query]);

  return (
    <div className="stack fade" style={{ maxWidth: 1100 }}>
      <div className="page-hd">
        <h1 className="page-title">Bookings</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className="btn btn-ghost" onClick={() => toast('Export started ✓')}>⬇ Export CSV</button>
          <Link to="/bookings/new" className="btn btn-pri">+ Manual booking</Link>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <SearchBox value={query} onChange={setQuery} placeholder="booking id / phone / name…" style={{ flex: 1, minWidth: 180 }} />
        {FILTERS.map((f) => (
          <button
            key={f.key}
            className={`chip ${filter === f.key ? 'on' : ''}`}
            onClick={() => setParams(f.key === 'all' ? {} : { status: f.key })}
          >
            {f.label}
          </button>
        ))}
        <select
          className="chip"
          style={{ appearance: 'none', cursor: 'pointer', background: cityF !== 'All' ? 'var(--green)' : 'var(--bg)', color: cityF !== 'All' ? 'var(--on-green)' : '#c7cbb9' }}
          value={cityF}
          onChange={(e) => setCityF(e.target.value)}
        >
          {cities.map((c) => (
            <option key={c} value={c}>{c === 'All' ? 'City ▾' : c}</option>
          ))}
        </select>
      </div>

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
            <span style={{ flex: 1.6 }}>{b.guest} · {b.phone.slice(0, 9)}…</span>
            <span style={{ flex: 1.8 }} className="muted">{eventTitle(b.eventId)}</span>
            <span style={{ flex: 1 }}>{b.qty} · ₹{fmt(b.amount)}</span>
            <span style={{ flex: 1 }}><Tag {...BOOKING_STATUS[b.status]} /></span>
          </div>
        ))}
        {list.length === 0 && <div className="trow muted">No bookings match.</div>}
      </div>
      <div className="tiny hint">Click a row for the fee breakdown, QR resend and refund actions.</div>

      {/* Abandoned carts — event-wise */}
      {(() => {
        const open = abandonedCarts.filter((c) => c.status === 'abandoned' && (cityF === 'All' || eventCity(c.eventId) === cityF));
        if (open.length === 0) return null;
        const m = new Map<string, { count: number; value: number }>();
        open.forEach((c) => {
          const cur = m.get(c.eventId) ?? { count: 0, value: 0 };
          cur.count += 1;
          cur.value += c.amount;
          m.set(c.eventId, cur);
        });
        const rows = [...m.entries()].sort((a, b) => b[1].value - a[1].value);
        const totalValue = open.reduce((a, c) => a + c.amount, 0);
        return (
          <div className="tblwrap">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)', flexWrap: 'wrap', gap: 6 }}>
              <span className="display" style={{ fontWeight: 700 }}>🛒 Abandoned carts by event</span>
              <span className="small muted">{open.length} open · ₹{fmt(totalValue)} recoverable · <Link to="/abandoned">recover →</Link></span>
            </div>
            <div className="thead" style={{ minWidth: 480 }}>
              <span style={{ flex: 2 }}>Event</span>
              <span style={{ flex: 1 }}>Carts</span>
              <span style={{ flex: 1 }}>Recoverable</span>
            </div>
            {rows.map(([id, v]) => (
              <Link key={id} to="/abandoned" className="trow clickable" style={{ minWidth: 480, textDecoration: 'none' }}>
                <span style={{ flex: 2, fontWeight: 700 }}>{eventTitle(id)}</span>
                <span style={{ flex: 1 }}>{v.count}</span>
                <span style={{ flex: 1 }} className="green">₹{fmt(v.value)}</span>
              </Link>
            ))}
          </div>
        );
      })()}

    </div>
  );
}
