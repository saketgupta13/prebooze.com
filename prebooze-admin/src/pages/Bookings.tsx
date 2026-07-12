import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { BOOKING_STATUS, Drawer, SearchBox, Tag } from '../components/ui';
import type { BookingStatus } from '../types';

type FilterKey = 'all' | BookingStatus;

const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'refund_requested', label: 'Refunds' },
  { key: 'paid', label: 'Paid' },
  { key: 'checked_in', label: 'Checked in' },
];

export default function Bookings() {
  const { bookings, events, resolveRefund, removeBooking, toast } = useAdmin();
  const [params, setParams] = useSearchParams();
  const filter = (params.get('status') as FilterKey) ?? 'all';
  const [query, setQuery] = useState(params.get('q') ?? '');
  const [cityF, setCityF] = useState('All');
  const [selectedId, setSelectedId] = useState<string | null>(null);
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

  const selected = bookings.find((b) => b.id === selectedId);
  const fee = selected ? selected.qty * 30 : 0;
  const gst = Math.round(fee * 0.18);

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
            onClick={() => setSelectedId(b.id)}
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

      {selected && (
        <Drawer onClose={() => setSelectedId(null)}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <b className="display" style={{ fontSize: 15 }}>{selected.id}</b>
            <span onClick={() => setSelectedId(null)} style={{ cursor: 'pointer', color: 'var(--muted)' }}>✕</span>
          </div>
          <div style={{ fontSize: 13 }}>
            <b>{selected.guest}</b> ✓<br />
            <span className="muted">{selected.phone}</span>
          </div>
          <hr />
          <div style={{ fontSize: 13 }}>
            {eventTitle(selected.eventId)}
            <br />
            <span className="muted">{selected.qty} × ticket · paid via {selected.method}</span>
          </div>
          <div className="dashed-box" style={{ fontSize: 12 }}>
            Subtotal ₹{fmt(selected.amount - fee - gst)}
            <br />
            Booking fee ₹{fmt(fee)}
            <br />
            GST ₹{fmt(gst)}
            <br />
            <b style={{ color: 'var(--text)' }}>Paid ₹{fmt(selected.amount)}</b> · {selected.method}
          </div>
          <div>
            <div className="small" style={{ fontWeight: 700, marginBottom: 4 }}>
              Guests on this booking ({(selected.guests ?? []).length || 1})
            </div>
            <div className="stack" style={{ gap: 4 }}>
              {(selected.guests ?? [`${selected.guest} (main)`]).map((g, i) => (
                <div
                  key={g}
                  style={{
                    display: 'flex',
                    gap: 8,
                    alignItems: 'center',
                    border: '1px solid rgba(139,195,74,.2)',
                    borderRadius: 6,
                    padding: '5px 9px',
                    fontSize: 11.5,
                  }}
                >
                  <span className="muted">{i + 1}.</span>
                  <span style={{ flex: 1 }}>{g}</span>
                </div>
              ))}
            </div>
            <div className="tiny hint" style={{ marginTop: 4 }}>one QR covers the whole group — partial check-in supported</div>
          </div>
          <div className="ph" style={{ height: 48 }}>1 × group QR · valid for {(selected.guests ?? []).length || 1} guest{((selected.guests ?? []).length || 1) > 1 ? 's' : ''}</div>
          {selected.status === 'refund_requested' && (
            <>
              <div style={{ border: '1px solid var(--red)', borderRadius: 8, padding: 10, color: 'var(--red-soft)', fontSize: 12.5 }}>
                ↩ Refund requested — “can't attend”
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="btn btn-pri btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => {
                    resolveRefund(selected.id, true);
                    setSelectedId(null);
                  }}
                >
                  Approve refund
                </button>
                <button
                  className="btn btn-ghost btn-sm"
                  style={{ flex: 1 }}
                  onClick={() => {
                    resolveRefund(selected.id, false);
                    setSelectedId(null);
                  }}
                >
                  Decline
                </button>
              </div>
            </>
          )}
          <a onClick={() => toast('Ticket resent via WhatsApp ✓')} className="small" style={{ textDecoration: 'underline', color: 'var(--muted)' }}>
            Resend ticket via WhatsApp
          </a>
          <button
            className="btn btn-danger btn-sm"
            onClick={() => {
              if (window.confirm(`Remove booking ${selected.id} from records?`)) {
                removeBooking(selected.id);
                setSelectedId(null);
              }
            }}
          >
            ✕ Remove booking
          </button>
        </Drawer>
      )}
    </div>
  );
}
