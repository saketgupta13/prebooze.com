import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { eventById, fmtDate, fmtTime, venueById } from '../data/mock';
import QRCode from '../components/QRCode';

export default function Confirmation() {
  const { id } = useParams();
  const { bookings, myEvents } = useApp();
  const booking = bookings.find((b) => b.id === decodeURIComponent(id ?? ''));
  const event = booking
    ? (eventById(booking.eventId) ?? myEvents.find((e) => e.id === booking.eventId))
    : undefined;

  if (!booking || !event) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Booking not found</h1>
          <Link to="/bookings" className="btn btn-pri" style={{ marginTop: 20 }}>
            My Bookings
          </Link>
        </div>
      </main>
    );
  }

  const venue = venueById(event.venueId);

  return (
    <main className="page">
      <div className="container confirm-hero">
        <div className="confirm-tick">✓</div>
        <h1 style={{ fontSize: 28 }}>You're going! 🎉</h1>
        <p className="muted" style={{ margin: '8px 0 22px' }}>
          Ticket sent to WhatsApp {booking.whatsapp} · paid ₹{booking.total} via Razorpay
        </p>

        <div className="card card-shadow" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 20 }}>{event.title}</h2>
          <div className="muted small" style={{ margin: '6px 0 4px' }}>
            {fmtDate(event.date)} · {fmtTime(event.date)} · {venue.name}, {venue.city}
          </div>
          <div className="small" style={{ marginBottom: 14 }}>
            {booking.tierName} · Booking {booking.id}{' '}
            <span className="badge badge-ok">Confirmed ✓</span>
          </div>
          <QRCode
            seed={booking.id}
            caption={`Scan at entry — valid for ${booking.qty} guest${booking.qty > 1 ? 's' : ''}`}
          />
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-pri" onClick={() => window.print()}>
              ⬇ Download QR
            </button>
            <button className="btn btn-ghost">Add to calendar</button>
            <Link to="/bookings" className="btn btn-ghost">
              View booking
            </Link>
          </div>
        </div>

        <Link to="/browse" className="link bold small" style={{ display: 'inline-block', marginTop: 18 }}>
          Browse more events →
        </Link>
      </div>
    </main>
  );
}
