import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { venuePartner, type OrgAttendee } from '../../api';
import { ApiError } from '../../api/client';
import type { Event } from '../../types';
import { AlertCircle, Download, QrCode, Check } from 'lucide-react';

const STATUS_FILTERS = ['All', 'Checked in', 'Confirmed', 'Refunded'];

interface Row extends OrgAttendee {
  eventId: string;
  eventTitle: string;
}

/** Real attendees across every event this venue hosts itself — mirrors
 * organizer/Attendees.tsx exactly (same N+1 per-event fetch, no single
 * cross-event endpoint), scoped to hosted events instead of an
 * organizer's own. No city filter here — unlike an organizer, who can
 * run events across many cities, a venue only ever has one. */
export default function VenueAttendees() {
  const [events, setEvents] = useState<Event[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [eventF, setEventF] = useState('All');

  useEffect(() => {
    venuePartner
      .hostedEvents()
      .then(async (evs) => {
        setEvents(evs);
        const perEvent = await Promise.all(
          evs.map((e) =>
            venuePartner.attendees(e.id).then((list) => list.map((a) => ({ ...a, eventId: e.id, eventTitle: e.title })))
          )
        );
        setRows(perEvent.flat());
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load attendees'))
      .finally(() => setLoading(false));
  }, []);

  const rowStatus = (r: Row) => (r.checkedIn ? 'checked-in' : r.bookingStatus === 'cancelled' || r.bookingStatus === 'refunded' ? 'refunded' : 'confirmed');

  const filtered = rows.filter((r) => {
    if (eventF !== 'All' && r.eventTitle !== eventF) return false;
    if (q && !(r.name + r.whatsapp + r.bookingId).toLowerCase().includes(q.toLowerCase())) return false;
    const s = rowStatus(r);
    if (status === 'Checked in') return s === 'checked-in';
    if (status === 'Confirmed') return s === 'confirmed';
    if (status === 'Refunded') return s === 'refunded';
    return true;
  });

  const total = rows.length;
  const checkedIn = rows.filter((r) => r.checkedIn).length;

  const exportCsv = () => {
    const csv = [
      'name,booking,phone,tier,event,status',
      ...filtered.map((r) => `"${r.name}",${r.bookingId},${r.whatsapp},"${r.tierName}","${r.eventTitle}",${rowStatus(r)}`),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
    a.download = 'attendees.csv';
    a.click();
  };

  return (
    <div>
      <div className="breadcrumb">
        <Link to="/venue/hosting/events">Events I host</Link> / {eventF === 'All' ? 'All events' : eventF} / Attendees
      </div>
      {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><AlertCircle size={14} /> {err}</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          placeholder="Search name / phone / booking #"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <select value={status} onChange={(e) => setStatus(e.target.value)} style={{ maxWidth: 140 }}>
          {STATUS_FILTERS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={eventF} onChange={(e) => setEventF(e.target.value)} style={{ maxWidth: 190 }}>
          <option>All</option>
          {events.map((e) => (
            <option key={e.id}>{e.title}</option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }} onClick={exportCsv}>
          <Download size={14} /> Export CSV
        </button>
        <Link to="/venue/hosting/scanner" className="btn btn-pri btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <QrCode size={14} /> Scan QR
        </Link>
      </div>

      <div className="card tbl-wrap">
        <table className="tbl">
          <thead>
            <tr>
              <th>Name · Booking</th>
              <th>Phone</th>
              <th>Tickets</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr><td colSpan={4} className="muted center">Loading…</td></tr>
            )}
            {!loading && filtered.map((r, i) => {
              const s = rowStatus(r);
              return (
                <tr key={r.bookingId + r.name + i}>
                  <td className="bold">
                    {r.username ? (
                      <Link to={`/u/${r.username}`} className="link" title="View their profile — events they're going to">
                        {r.name}
                      </Link>
                    ) : (
                      r.name
                    )}{' '}
                    <span className="muted-2">· {r.bookingId}</span>
                  </td>
                  <td className="muted">{r.whatsapp}</td>
                  <td>{r.tierName}</td>
                  <td>
                    {s === 'checked-in' && <span className="badge badge-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Checked in <Check size={12} /></span>}
                    {s === 'confirmed' && <span className="badge badge-pending">Confirmed</span>}
                    {s === 'refunded' && <span className="badge badge-danger">Refunded</span>}
                  </td>
                </tr>
              );
            })}
            {!loading && filtered.length === 0 && (
              <tr>
                <td colSpan={4} className="muted center">
                  No attendees match.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      <div className="small muted" style={{ marginTop: 10 }}>
        {total} attendees · {checkedIn} checked in
      </div>
    </div>
  );
}
