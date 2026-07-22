import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { BOOKING_STATUS, Tag } from '../components/ui';
import QRCode from '../components/QRCode';

const waLink = (phone: string, message: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

/** Full booking detail — fee breakdown, group QR guest list, refund and
 * support actions. Same data the old drawer showed, just given a real page
 * (and a real URL) instead of a transient overlay. */
export default function BookingDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { bookings, events, resolveRefund, removeBooking, toast } = useAdmin();

  const booking = bookings.find((b) => b.id === id);
  if (!booking) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Booking not found</h1>
        <Link to="/bookings" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Bookings</Link>
      </div>
    );
  }

  const event = events.find((e) => e.id === booking.eventId);
  const fee = booking.qty * 30;
  const gst = Math.round(fee * 0.18);
  const guestList = booking.guests ?? [{ name: booking.guest, phone: booking.phone, verified: true }];

  return (
    <div className="stack fade" style={{ maxWidth: 720, gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/bookings" style={{ fontSize: 13 }}>← Bookings</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{booking.id}</h1>
        <Tag {...BOOKING_STATUS[booking.status]} />
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Guest</div>
        <div className="tiny muted">{booking.guest} · {booking.phone}</div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Event</div>
        {event ? (
          <div className="tiny">
            <span
              style={{ cursor: 'pointer', textDecoration: 'underline' }}
              onClick={() => navigate(`/events/${event.id}`)}
            >
              {event.title}
            </span>
            <span className="muted"> · {event.date} · {event.city}</span>
          </div>
        ) : (
          <div className="tiny muted">Event not found (may have been removed)</div>
        )}
        <div className="tiny muted">{booking.qty} × ticket · paid via {booking.method}</div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Fee breakdown</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span className="muted">Subtotal</span><span>₹{fmt(booking.amount - fee - gst)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span className="muted">Booking fee</span><span>₹{fmt(fee)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span className="muted">GST</span><span>₹{fmt(gst)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, paddingTop: 6, borderTop: '1px solid rgba(139,195,74,.15)' }}>
          <span>Paid</span><span className="green">₹{fmt(booking.amount)} · {booking.method}</span>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="display" style={{ fontWeight: 700 }}>Guests on this booking ({guestList.length})</div>
        <div className="stack" style={{ gap: 4 }}>
          {guestList.map((g, i) => (
            <div
              key={g.name + i}
              style={{
                display: 'flex', gap: 8, alignItems: 'center',
                border: '1px solid rgba(139,195,74,.2)', borderRadius: 6, padding: '6px 9px', fontSize: 12,
              }}
            >
              <span className="muted">{i + 1}.</span>
              <span style={{ flex: 1, fontWeight: 700 }}>
                {g.name} {i === 0 && <span className="tiny muted" style={{ fontWeight: 400 }}>(main)</span>} {g.verified && '✓'}
              </span>
              <span className="muted">{g.phone ?? 'no phone on file'}</span>
            </div>
          ))}
        </div>
        <div className="tiny hint">full name and mobile number for every attendee — never masked for admin</div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div className="display" style={{ fontWeight: 700, alignSelf: 'flex-start' }}>Group entry QR</div>
        <QRCode seed={booking.id} caption={`valid for ${guestList.length} guest${guestList.length > 1 ? 's' : ''}`} />
        <div className="tiny hint">one QR covers the whole group — partial check-in supported at the gate</div>
      </div>

      {booking.status === 'refund_requested' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ color: 'var(--red-soft)', fontSize: 12.5, fontWeight: 700 }}>↩ Refund requested — "can't attend"</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-pri btn-sm" style={{ flex: 1 }} onClick={() => resolveRefund(booking.id, true)}>
              Approve refund
            </button>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={() => resolveRefund(booking.id, false)}>
              Decline
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            // prebooze-admin has no live backend wiring (mock/localStorage
            // only, same as the rest of this app) so a real AiSensy template
            // send isn't reachable from here — a real wa.me deep link with
            // the actual ticket details is the most honest "real" resend
            // available: it genuinely opens WhatsApp with a real, sendable
            // message to the guest's real number, not a fake toast.
            const msg = `Hey ${booking.guest.split(' ')[0]}, resending your Prebooze ticket for ${event?.title ?? 'your event'} — booking ${booking.id}, ${booking.qty} × ticket. See you there! 🎟`;
            window.open(waLink(booking.phone, msg), '_blank', 'noopener');
            toast('WhatsApp opened with the ticket message ✓');
          }}
        >
          Resend ticket via WhatsApp
        </button>
        <button
          className="btn btn-danger btn-sm"
          onClick={() => {
            if (window.confirm(`Remove booking ${booking.id} from records?`)) {
              removeBooking(booking.id);
              navigate('/bookings');
            }
          }}
        >
          ✕ Remove booking
        </button>
      </div>
    </div>
  );
}
