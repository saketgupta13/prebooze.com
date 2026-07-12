import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { ATTENDEES, EVENTS, eventById, venueById } from '../../data/mock';
import type { Attendee } from '../../types';

const STATUS_FILTERS = ['All', 'Checked in', 'Confirmed', 'Refunded'];

export default function Attendees() {
  const { bookings, myEvents } = useApp();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('All');
  const [eventF, setEventF] = useState('All');
  const [cityF, setCityF] = useState('All');
  const orgEvents = [...myEvents, ...EVENTS.filter((e) => e.organizerId === 'livewire' && !myEvents.some((m) => m.id === e.id))];
  const cityOf = (eventId: string | undefined) => {
    if (!eventId) return 'Austin';
    const ev = myEvents.find((e) => e.id === eventId) ?? eventById(eventId);
    return ev ? (venueById(ev.venueId)?.city ?? 'Austin') : 'Austin';
  };
  const cities = ['All', ...new Set(orgEvents.map((e) => venueById(e.venueId)?.city).filter(Boolean) as string[])];

  // Merge seeded attendees with real bookings made in this browser
  const rows = useMemo<Attendee[]>(() => {
    const fromBookings: (Attendee & { eventId?: string })[] = bookings.map((b) => ({
      bookingId: b.id,
      eventId: b.eventId,
      name: b.mainGuest,
      phone: b.whatsapp.slice(0, 6) + '•••' + b.whatsapp.slice(-3),
      tickets: b.tierName,
      qty: b.qty,
      status:
        b.status === 'cancelled'
          ? 'refunded'
          : b.guests.some((g) => g.checkedIn)
            ? 'checked-in'
            : 'confirmed',
    }));
    return [...fromBookings, ...ATTENDEES.map((a) => ({ ...a, eventId: 'ev-1' }))];
  }, [bookings]);

  const filtered = rows.filter((r) => {
    const rEvent = (r as Attendee & { eventId?: string }).eventId;
    if (eventF !== 'All') {
      const ev = myEvents.find((e) => e.id === rEvent) ?? eventById(rEvent ?? '');
      if ((ev?.title ?? '') !== eventF) return false;
    }
    if (cityF !== 'All' && cityOf(rEvent) !== cityF) return false;
    if (q && !(r.name + r.phone + r.bookingId).toLowerCase().includes(q.toLowerCase())) return false;
    if (status === 'Checked in') return r.status === 'checked-in';
    if (status === 'Confirmed') return r.status === 'confirmed';
    if (status === 'Refunded') return r.status === 'refunded';
    return true;
  });

  const total = rows.reduce((a, r) => a + r.qty, 0);
  const checkedIn = rows.filter((r) => r.status === 'checked-in').reduce((a, r) => a + r.qty, 0);

  const exportCsv = () => {
    const csv = [
      'name,booking,phone,tickets,status',
      ...rows.map((r) => `"${r.name}",${r.bookingId},${r.phone},"${r.tickets}",${r.status}`),
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
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', marginBottom: 16 }}>
        <input
          placeholder="🔍 Search name / phone / booking #"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          style={{ maxWidth: 280 }}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          style={{ maxWidth: 140 }}
        >
          {STATUS_FILTERS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
        <select value={eventF} onChange={(e) => setEventF(e.target.value)} style={{ maxWidth: 190 }}>
          <option>All</option>
          {orgEvents.map((e) => (
            <option key={e.id}>{e.title}</option>
          ))}
        </select>
        <select value={cityF} onChange={(e) => setCityF(e.target.value)} style={{ maxWidth: 130 }}>
          {cities.map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
        <span style={{ flex: 1 }} />
        <button className="btn btn-ghost btn-sm" onClick={exportCsv}>
          ⬇ Export CSV
        </button>
        <Link to="/organizer/scanner" className="btn btn-pri btn-sm">
          📷 Scan QR
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
            {filtered.map((r) => (
              <tr key={r.bookingId + r.name}>
                <td className="bold">
                  {r.name} <span className="muted-2">· {r.bookingId}</span>
                </td>
                <td className="muted">{r.phone}</td>
                <td>{r.tickets}</td>
                <td>
                  {r.status === 'checked-in' && <span className="badge badge-ok">Checked in ✓</span>}
                  {r.status === 'confirmed' && <span className="badge badge-pending">Confirmed</span>}
                  {r.status === 'refunded' && <span className="badge badge-danger">Refunded</span>}
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
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
