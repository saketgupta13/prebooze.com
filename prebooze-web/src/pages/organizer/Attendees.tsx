import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { organizer, type OrgAttendee } from '../../api';
import { ApiError } from '../../api/client';
import type { Event } from '../../types';
import { X, Search, Download, Camera, CheckCircle2 } from 'lucide-react';

const STATUS_FILTERS = ['All', 'Checked in', 'Confirmed', 'Refunded'];

interface Row extends OrgAttendee {
  eventId: string;
  eventTitle: string;
  city: string;
}

/** Real attendees across every event this organizer runs — GET
 * /organizer/events then GET /organizer/events/:id/attendees per event
 * (no single cross-event endpoint exists, same N+1 as Dashboard). */
export default function Attendees() {
  const [events, setEvents] = useState<Event[]>([]);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [eventF, setEventF] = useState('All');
  const [cityF, setCityF] = useState('All');

  useEffect(() => {
    organizer
      .events()
      .then(async (evs) => {
        setEvents(evs);
        const perEvent = await Promise.all(
          evs.map((e) =>
            organizer.attendees(e.id).then((list) => list.map((a) => ({ ...a, eventId: e.id, eventTitle: e.title, city: e.venue?.city ?? e.privateCity ?? '' })))
          )
        );
        setRows(perEvent.flat());
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load attendees'))
      .finally(() => setLoading(false));
  }, []);

  const cities = useMemo(() => ['All', ...new Set(events.map((e) => e.venue?.city ?? e.privateCity).filter(Boolean) as string[])], [events]);

  const rowStatus = (r: Row) => (r.checkedIn ? 'checked-in' : r.bookingStatus === 'cancelled' || r.bookingStatus === 'refunded' ? 'refunded' : 'confirmed');

  const filtered = rows.filter((r) => {
    if (eventF !== 'All' && r.eventTitle !== eventF) return false;
    if (cityF !== 'All' && r.city !== cityF) return false;
    if (q && !(r.name + r.whatsapp + r.bookingId).toLowerCase().includes(q.toLowerCase())) return false;
    const s = rowStatus(r);
    if (status === 'Checked in') return s === 'checked-in';
    if (status === 'Confirmed') return s === 'confirmed';
    if (status === 'Refunded') return s === 'refunded';
    return true;
  });

  const total = rows.length;
  const checkedIn = rows.filter((r) => r.checkedIn).length;

  // Exports whatever's currently filtered, not every attendee ever — an
  // organizer picking a single event (e.g. to manually message a
  // private-address event's guests the real venue) needs just that list,
  // not their entire booking history mixed in.
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
        <Link to="/organizer/events">Events</Link> / {eventF === 'All' ? 'All events' : eventF} / Attendees
      </div>
      {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> {err}</div>}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <div style={{ position: 'relative', maxWidth: 280 }}>
          <Search size={14} style={{ position: 'absolute', left: 10, top: '50%', transform: 'translateY(-50%)', opacity: 0.5 }} />
          <input
            placeholder="Search name / phone / booking #"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{ width: '100%', paddingLeft: 30 }}
          />
        </div>
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
        <select value={cityF} onChange={(e) => setCityF(e.target.value)} style={{ maxWidth: 130 }}>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={exportCsv} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Download size={15} /> Export CSV
        </button>
        <Link to="/organizer/scanner" className="btn btn-pri btn-sm" style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
          <Camera size={15} /> Scan QR
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
                    {s === 'checked-in' && <span className="badge badge-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Checked in <CheckCircle2 size={13} /></span>}
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
