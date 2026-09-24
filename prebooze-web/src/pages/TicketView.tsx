import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { CheckCircle2, Calendar, MapPin } from 'lucide-react';
import { bookings } from '../api';
import { ApiError } from '../api/client';
import { PageLoader } from '../components/Loader';
import QRCode from '../components/QRCode';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

type Ticket = Awaited<ReturnType<typeof bookings.ticketView>>;

/** Public, no-login ticket view — the link an offline booking's WhatsApp
 * confirmation carries (BookingsService.ticketView/sendOfflineBookingConfirmation).
 * This guest was never logged in to begin with (no OTP session — an
 * organizer created this booking on their behalf), so the normal
 * /confirmation/:id page (RequireAuth-gated) would be a dead end. The
 * booking's own signed qrToken in the URL doubles as the access credential
 * — same trust level as the QR code itself, no separate login needed. */
export default function TicketView() {
  const { token } = useParams();
  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (!token) { setErr('Invalid ticket link'); return; }
    bookings.ticketView(token)
      .then(setTicket)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Could not load this ticket'));
  }, [token]);

  if (err) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1 style={{ fontSize: 22 }}>{err}</h1>
          <Link to="/" className="btn btn-pri" style={{ marginTop: 20 }}>Back to Prebooze</Link>
        </div>
      </main>
    );
  }
  if (!ticket) return <PageLoader />;

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 440 }}>
        <div className="card card-shadow" style={{ textAlign: 'center', padding: 24 }}>
          {ticket.status === 'confirmed' && (
            <div className="tiny" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent)', marginBottom: 10 }}>
              <CheckCircle2 size={14} /> {ticket.checkedIn ? 'Already checked in' : 'Confirmed'}
            </div>
          )}
          {ticket.status !== 'confirmed' && (
            <div className="badge badge-danger" style={{ marginBottom: 10 }}>{ticket.status.replace('_', ' ')}</div>
          )}
          <h1 style={{ fontSize: 20, marginBottom: 4 }}>{ticket.event.title}</h1>
          <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', marginBottom: 2 }}>
            <Calendar size={13} /> {fmtDate(ticket.event.date)}, {fmtTime(ticket.event.date)}
          </div>
          {(ticket.event.venueName || ticket.event.city) && (
            <div className="muted small" style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'center', marginBottom: 16 }}>
              <MapPin size={13} /> {[ticket.event.venueName, ticket.event.city].filter(Boolean).join(', ')}
            </div>
          )}

          {ticket.status === 'confirmed' ? (
            <QRCode value={ticket.qrToken} caption={ticket.id} />
          ) : (
            <p className="muted small">This ticket is {ticket.status.replace('_', ' ')} and can't be used for entry.</p>
          )}

          <div style={{ textAlign: 'left', margin: '18px 0 0', paddingTop: 14, borderTop: '1px dashed var(--border-dash)' }}>
            <div className="tiny muted" style={{ marginBottom: 6 }}>Guests</div>
            <div className="small">{ticket.guests.map((g) => g.name).join(', ')}</div>
            <div className="tiny muted-2" style={{ marginTop: 4 }}>{ticket.tierName} · {ticket.qty} · ₹{ticket.total}</div>
          </div>
        </div>

        <p className="tiny muted-2" style={{ textAlign: 'center', marginTop: 16 }}>
          Log in on Prebooze with this same WhatsApp number (we'll text you an OTP) to see this and every other booking
          any time.
        </p>
        <Link to="/login" className="btn btn-ghost btn-block" style={{ marginTop: 10 }}>Log in to see my bookings</Link>
      </div>
    </main>
  );
}
