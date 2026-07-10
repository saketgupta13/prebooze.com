import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { eventById, fmtDate, fmtTime, venueById } from '../data/mock';
import QRCode from '../components/QRCode';

export default function MyBookings() {
  const { bookings, cancelBooking, myEvents } = useApp();
  const [tab, setTab] = useState<'upcoming' | 'past'>('upcoming');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const resolveEvent = (eventId: string) =>
    eventById(eventId) ?? myEvents.find((e) => e.id === eventId);

  const list = useMemo(() => {
    const now = Date.now();
    return bookings.filter((b) => {
      const ev = resolveEvent(b.eventId);
      if (!ev) return false;
      const isPast = new Date(ev.date).getTime() < now;
      return tab === 'past' ? isPast : !isPast;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bookings, tab, myEvents]);

  const selected = list.find((b) => b.id === selectedId) ?? list[0];
  const event = selected ? resolveEvent(selected.eventId) : undefined;
  const venue = event ? venueById(event.venueId) : undefined;

  return (
    <main className="page">
      <div className="container">
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>My Bookings</h1>
        <div className="tabs">
          <button className={tab === 'upcoming' ? 'on' : ''} onClick={() => setTab('upcoming')}>
            Upcoming
          </button>
          <button className={tab === 'past' ? 'on' : ''} onClick={() => setTab('past')}>
            Past
          </button>
        </div>

        {list.length === 0 ? (
          <div className="empty">
            No {tab} bookings yet.{' '}
            <Link to="/browse" className="link">
              Browse events →
            </Link>
          </div>
        ) : (
          <div className="bookings-grid">
            <div className="blist">
              {list.map((b) => {
                const ev = resolveEvent(b.eventId);
                return (
                  <button
                    key={b.id}
                    className={`blist-item ${selected?.id === b.id ? 'on' : ''}`}
                    onClick={() => setSelectedId(b.id)}
                  >
                    <div className="t">{ev?.title}</div>
                    <div className="m">
                      {ev && fmtDate(ev.date)} · {b.qty} tix
                      {b.status === 'cancelled' && (
                        <span className="danger-text"> · cancelled</span>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>

            {selected && event && venue && (
              <div className="card card-shadow" style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>
                <div style={{ flex: 1, minWidth: 240 }}>
                  <h2 style={{ fontSize: 20 }}>{event.title}</h2>
                  <div style={{ display: 'grid', gap: 7, margin: '12px 0', fontSize: 14 }} className="muted">
                    <span>📅 {fmtDate(event.date)}, {fmtTime(event.date)}</span>
                    <span>📍 {venue.name}, {venue.city}</span>
                    <span>🎟 {selected.tierName} · {selected.id}</span>
                    <span>
                      💳 Paid ₹{selected.total} ·{' '}
                      {selected.status === 'confirmed' ? (
                        <span className="badge badge-ok">Confirmed ✓</span>
                      ) : (
                        <span className="badge badge-danger">Cancelled</span>
                      )}
                    </span>
                  </div>
                  <div className="small muted-2" style={{ marginBottom: 14 }}>
                    Guests: {selected.guests.map((g) => g.name).join(' · ')}
                  </div>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <button className="btn btn-ghost btn-sm">Resend to WhatsApp</button>
                    {selected.status === 'confirmed' && (
                      <button
                        className="btn btn-danger btn-sm"
                        onClick={() => {
                          if (window.confirm('Cancel this booking? Refund lands back on your payment method.'))
                            cancelBooking(selected.id);
                        }}
                      >
                        Cancel booking
                      </button>
                    )}
                  </div>
                </div>
                {selected.status === 'confirmed' && (
                  <div style={{ textAlign: 'center' }}>
                    <QRCode seed={selected.id} caption={`valid for ${selected.qty} guest${selected.qty > 1 ? 's' : ''}`} />
                    <div style={{ marginTop: 10 }}>
                      <button className="btn btn-pri btn-sm" onClick={() => window.print()}>
                        ⬇ Download QR
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}
