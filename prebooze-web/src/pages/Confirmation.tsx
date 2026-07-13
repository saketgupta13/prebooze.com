import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { eventById, fmtDate, fmtTime, venueById } from '../data/mock';
import QRCode from '../components/QRCode';

export default function Confirmation() {
  const { id } = useParams();
  const { bookings, myEvents, user, updateUser } = useApp();
  const [copied, setCopied] = useState(false);
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
  const shareUrl = `${window.location.origin}/events/${event.slug}`;
  const visibility = user?.attendanceVisibility ?? 'off';
  const copy = () => {
    navigator.clipboard?.writeText(shareUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };
  const waShare = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(`I'm going to ${event.title}! 🎟️ ${shareUrl}`)}`, '_blank');

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

        <div className="card" style={{ textAlign: 'left', marginTop: 16 }}>
          <h3 style={{ marginBottom: 2 }}>Tell your people 📣</h3>
          <p className="small muted" style={{ marginBottom: 10 }}>Bring your crew — share you're going and pull them in.</p>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button className="btn btn-whatsapp btn-sm" onClick={waShare}>💬 Share on WhatsApp</button>
            <button className="btn btn-ghost btn-sm" onClick={copy}>{copied ? 'Link copied ✓' : '🔗 Copy link'}</button>
          </div>
          {visibility === 'off' ? (
            <div className="dashed-box" style={{ marginTop: 12, fontSize: 12.5, border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: '10px 12px' }}>
              You're hidden on <b>“Who's going”</b> — friends who follow you can't see you're in.{' '}
              <button
                className="link bold"
                style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0 }}
                onClick={() => updateUser({ attendanceVisibility: 'followers' })}
              >
                Let followers see you're going →
              </button>
            </div>
          ) : (
            <div className="tiny muted-2" style={{ marginTop: 12 }}>
              ✓ Visible to {visibility === 'public' ? 'everyone' : 'your followers'} on “Who's going”. Change in your profile.
            </div>
          )}
        </div>

        <Link to="/browse" className="link bold small" style={{ display: 'inline-block', marginTop: 18 }}>
          Browse more events →
        </Link>
      </div>
    </main>
  );
}
