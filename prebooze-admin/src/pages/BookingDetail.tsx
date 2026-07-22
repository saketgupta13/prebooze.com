import { Link, useNavigate, useParams } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { BOOKING_STATUS, Tag } from '../components/ui';

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
  const guestList = booking.guests ?? [`${booking.guest} (main)`];

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
              key={g}
              style={{
                display: 'flex', gap: 8, alignItems: 'center',
                border: '1px solid rgba(139,195,74,.2)', borderRadius: 6, padding: '5px 9px', fontSize: 12,
              }}
            >
              <span className="muted">{i + 1}.</span>
              <span style={{ flex: 1 }}>{g}</span>
            </div>
          ))}
        </div>
        <div className="tiny hint">one QR covers the whole group — partial check-in supported</div>
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
        <button className="btn btn-ghost btn-sm" onClick={() => toast('Ticket resent via WhatsApp ✓')}>
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
