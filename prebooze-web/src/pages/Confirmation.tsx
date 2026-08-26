import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { eventById, fmtDate, fmtTime, venueById } from '../data/mock';
import { bookings as bookingsApi } from '../api';
import { isBackendEnabled } from '../api/client';
import type { Booking } from '../types';
import QRCode from '../components/QRCode';
import { downloadTicket } from '../lib/ticket';
import { downloadIcs } from '../lib/calendar';
import { eventLocation } from '../lib/venue';
import { copyToClipboard } from '../lib/clipboard';
import { cityBrowse } from '../lib/urls';
import { formatPrice } from '../lib/formatPrice';
import { tierGraceEndDate, formatCountdownDHM } from '../lib/ticketTierPricing';
import { useTicker } from '../lib/useTicker';

export default function Confirmation() {
  const { id } = useParams();
  const { bookings, myEvents, user, setAttendanceVisibility, city } = useApp();
  const [copied, setCopied] = useState(false);
  const [copyErr, setCopyErr] = useState('');

  const [liveBookings, setLiveBookings] = useState<Booking[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    bookingsApi.list().then(setLiveBookings).catch(() => setLiveBookings([]));
  }, []);
  useTicker(); // keeps the free-entry countdown below from going stale (5-min tick)

  const loading = isBackendEnabled() && liveBookings === null;
  const booking = (liveBookings ?? bookings).find((b) => b.id === decodeURIComponent(id ?? ''));
  const event = booking
    ? (booking.event ?? eventById(booking.eventId) ?? myEvents.find((e) => e.id === booking.eventId))
    : undefined;

  if (loading) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Loading your ticket…</h1>
        </div>
      </main>
    );
  }

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

  const venue = event.venue ?? (event.venueId ? venueById(event.venueId) : undefined);
  // Only for a free ticket bought under an active time-limited-entry tier —
  // reminds the guest of the real deadline (cutoff + grace) for the door to
  // still honor a free ticket, same guest-pass-style countdown as
  // GuestPass.tsx uses for the exact same "arrive before this" purpose.
  const bookedTier = event.tiers?.find((t) => t.id === booking.tierId);
  const graceEnd = bookedTier?.freeCutoff ? tierGraceEndDate(event.date, bookedTier.freeCutoff) : null;
  const showGateCountdown = graceEnd && Date.now() < graceEnd.getTime();
  const shareUrl = `${window.location.origin}/events/${event.slug}`;
  const visibility = user?.attendanceVisibility ?? 'off';
  const copy = async () => {
    setCopyErr('');
    const ok = await copyToClipboard(shareUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } else {
      setCopyErr('Could not copy — long-press or select the link to copy it manually');
    }
  };
  const waShare = () =>
    window.open(`https://wa.me/?text=${encodeURIComponent(`I'm going to ${event.title}! 🎟️ ${shareUrl}`)}`, '_blank');

  return (
    <main className="page">
      <div className="container confirm-hero">
        <div className="confirm-tick">✓</div>
        <h1 style={{ fontSize: 28 }}>You're going! 🎉</h1>
        <p className="muted" style={{ margin: '8px 0 22px' }}>
          Ticket sent to WhatsApp {booking.whatsapp}
          {booking.total > 0 ? ` · paid ${formatPrice(booking.total)} via Razorpay` : ' · Free entry'}
        </p>

        <div className="card card-shadow" style={{ textAlign: 'center' }}>
          <h2 style={{ fontSize: 20 }}>{event.title}</h2>
          <div className="muted small" style={{ margin: '6px 0 4px' }}>
            {fmtDate(event.date)} · {fmtTime(event.date)} · {eventLocation(event, venue)}
          </div>
          <div className="small" style={{ marginBottom: 14 }}>
            {booking.tierName} · Booking {booking.id}{' '}
            <span className="badge badge-ok">Confirmed ✓</span>
          </div>
          {!!booking.coverCharge && (
            <div className="small accent" style={{ marginBottom: 14 }}>
              🍹 Includes ₹{booking.coverCharge} redeemable at the venue
            </div>
          )}
          <QRCode
            value={booking.qrToken || booking.id}
            caption={`Scan at entry — valid for ${booking.guests.length} guest${booking.guests.length > 1 ? 's' : ''}`}
          />
          {showGateCountdown && graceEnd && (
            <div
              style={{
                marginTop: 16,
                padding: '10px 14px',
                borderRadius: 10,
                border: '1.5px solid var(--accent)',
                background: 'rgba(155,225,61,.08)',
              }}
            >
              <div className="tiny muted-2">Free entry honored for</div>
              <div style={{ fontSize: 22, fontWeight: 800 }} className="accent">
                {formatCountdownDHM(graceEnd.getTime())}
              </div>
              <div className="tiny muted-2">
                arrive by {graceEnd.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' })} — after that it's the venue's call, not guaranteed by Prebooze
              </div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 16, flexWrap: 'wrap' }}>
            <button className="btn btn-pri" onClick={() => downloadTicket(booking, event, venue)}>
              ⬇ Download ticket
            </button>
            <button className="btn btn-ghost" onClick={() => downloadIcs(event, venue)}>📅 Add to calendar</button>
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
          {copyErr && <div className="tiny danger-text" style={{ marginTop: 6 }}>{copyErr}</div>}
          {visibility === 'off' ? (
            <div className="dashed-box" style={{ marginTop: 12, fontSize: 12.5, border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: '10px 12px' }}>
              You're hidden on <b>“Who's going”</b> — friends who follow you can't see you're in.{' '}
              <button
                className="link bold"
                style={{ background: 'none', border: 'none', cursor: 'pointer', font: 'inherit', padding: 0 }}
                onClick={() => setAttendanceVisibility('followers')}
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

        {!user?.profileRewardClaimedAt && (liveBookings ?? bookings).length === 1 && (
          <div className="card card-shadow" style={{ textAlign: 'left', marginTop: 16, borderColor: 'var(--accent)' }}>
            <h3 style={{ marginBottom: 2 }}>🎁 Get 10% off your next booking</h3>
            <p className="small muted" style={{ marginBottom: 10 }}>
              Finish a few more details on your profile — photo, bio, interests — and we'll send you a one-time 10% off code (up to ₹100), valid for 15 days.
            </p>
            <Link to="/finish-profile" className="btn btn-pri btn-sm">Complete your profile →</Link>
          </div>
        )}

        <Link to={cityBrowse(city)} className="link bold small" style={{ display: 'inline-block', marginTop: 18 }}>
          Browse more events →
        </Link>
      </div>
    </main>
  );
}
