import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { venuePartner, type OrgBooking } from '../../api';
import { ApiError } from '../../api/client';
import { fmtMoney } from '../../data/mock';
import { AlertCircle, Download, QrCode, CheckCircle2, ArrowLeft } from 'lucide-react';

const STATUS_FILTERS = ['All', 'Checked in', 'Confirmed', 'Refund requested', 'Refunded', 'Cancelled'];
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

type RowStatus = 'checked-in' | OrgBooking['status'];
const rowStatus = (b: OrgBooking): RowStatus => (b.checkedIn ? 'checked-in' : b.status);
const isEventOver = (e: { date: string; durationHrs: number }) => new Date(e.date).getTime() + e.durationHrs * 3600_000 < Date.now();

/** Mirrors organizer/Bookings.tsx exactly, scoped to events this venue
 * hosts itself instead of an organizer's — one row per booking, real
 * event-grouped summary with a live/past split as the landing view. GET
 * /venue/hosting/bookings replaces the old per-event N+1 fan-out. */
export default function VenueBookings() {
  const [params, setParams] = useSearchParams();
  const [bookings, setBookings] = useState<OrgBooking[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [scope, setScope] = useState<'live' | 'past'>('live');
  const eventF = params.get('event');

  useEffect(() => {
    venuePartner
      .bookings()
      .then(setBookings)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load bookings'))
      .finally(() => setLoading(false));
  }, []);

  const showingSummary = !eventF && !q.trim() && status === 'All';
  const scopedEvent = eventF ? bookings.find((b) => b.event.id === eventF)?.event : undefined;

  const eventsSummary = useMemo(() => {
    const m = new Map<string, { title: string; date: string; durationHrs: number; count: number; qty: number; revenue: number }>();
    for (const b of bookings) {
      const cur = m.get(b.event.id) ?? { title: b.event.title, date: b.event.date, durationHrs: b.event.durationHrs, count: 0, qty: 0, revenue: 0 };
      cur.count += 1;
      cur.qty += b.qty;
      if (b.status === 'confirmed' || b.status === 'refund_requested') cur.revenue += b.total;
      m.set(b.event.id, cur);
    }
    return [...m.entries()]
      .filter(([, v]) => isEventOver(v) === (scope === 'past'))
      .sort((a, b) => (scope === 'live' ? a[1].date.localeCompare(b[1].date) : b[1].date.localeCompare(a[1].date)));
  }, [bookings, scope]);

  const filtered = useMemo(() => {
    let l = eventF ? bookings.filter((b) => b.event.id === eventF) : bookings;
    if (status !== 'All') {
      const want: RowStatus = status === 'Checked in' ? 'checked-in' : status === 'Confirmed' ? 'confirmed' : status === 'Refund requested' ? 'refund_requested' : status === 'Refunded' ? 'refunded' : 'cancelled';
      l = l.filter((b) => rowStatus(b) === want);
    }
    if (q.trim()) {
      const s = q.toLowerCase();
      l = l.filter((b) => (b.mainGuest + b.whatsapp + b.id).toLowerCase().includes(s));
    }
    return l;
  }, [bookings, eventF, status, q]);

  const exportCsv = () => {
    const csv = [
      'id,guest,phone,tier,qty,amount,event,status',
      ...filtered.map((b) => `${b.id},"${b.mainGuest}",${b.whatsapp},"${b.tierName}",${b.qty},${b.total},"${b.event.title}",${rowStatus(b)}`),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'bookings.csv';
    a.click();
  };

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/venue/hosting/events">Events I host</Link> / {eventF ? (scopedEvent?.title ?? 'Bookings') : 'All events'} / Bookings
      </div>
      {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={14} /> {err}</div>}

      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <input placeholder="Search booking # / name / phone" value={q} onChange={(e) => setQ(e.target.value)} style={{ maxWidth: 280 }} />
        {!showingSummary && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 170 }}>
            {STATUS_FILTERS.map((s) => <option key={s}>{s}</option>)}
          </select>
        )}
        {eventF && (
          <Link to="/venue/hosting/bookings" className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <ArrowLeft size={13} /> All events
          </Link>
        )}
        <span style={{ flex: 1 }} />
        {!showingSummary && (
          <button className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={exportCsv}>
            <Download size={14} /> Export CSV
          </button>
        )}
        <Link to="/venue/hosting/scanner" className="btn btn-pri btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <QrCode size={14} /> Scan QR
        </Link>
      </div>

      {showingSummary ? (
        <div className="card tbl-wrap">
          <div className="tabs" style={{ marginBottom: 10 }}>
            <button className={scope === 'live' ? 'on' : ''} onClick={() => setScope('live')}>Live</button>
            <button className={scope === 'past' ? 'on' : ''} onClick={() => setScope('past')}>Past</button>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Event</th>
                <th>Date</th>
                <th>Bookings</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={4} className="muted center">Loading…</td></tr>}
              {!loading && eventsSummary.map(([id, v]) => (
                <tr key={id} onClick={() => setParams({ event: id })} style={{ cursor: 'pointer' }}>
                  <td className="bold">{v.title}</td>
                  <td className="muted">{fmtDate(v.date)}</td>
                  <td>{v.count} · {v.qty} tix</td>
                  <td className="accent">{fmtMoney(v.revenue)}</td>
                </tr>
              ))}
              {!loading && eventsSummary.length === 0 && (
                <tr><td colSpan={4} className="muted center">No {scope} events with bookings.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="card tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>#ID</th>
                <th>Guest</th>
                <th>Event</th>
                <th>Qty · Amount</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {loading && <tr><td colSpan={5} className="muted center">Loading…</td></tr>}
              {!loading && filtered.map((b) => {
                const s = rowStatus(b);
                return (
                  <tr key={b.id}>
                    <td className="bold">{b.id}</td>
                    <td>{b.mainGuest} <span className="muted-2">· {b.whatsapp}</span></td>
                    <td className="muted">{b.event.title}</td>
                    <td>{b.qty} · {fmtMoney(b.total)}</td>
                    <td>
                      {s === 'checked-in' && <span className="badge badge-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Checked in <CheckCircle2 size={13} /></span>}
                      {s === 'confirmed' && <span className="badge badge-pending">Confirmed</span>}
                      {s === 'refund_requested' && <span className="badge badge-danger">Refund req.</span>}
                      {s === 'refunded' && <span className="badge badge-danger">Refunded</span>}
                      {s === 'cancelled' && <span className="badge">Cancelled</span>}
                    </td>
                  </tr>
                );
              })}
              {!loading && filtered.length === 0 && (
                <tr><td colSpan={5} className="muted center">No bookings match.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
