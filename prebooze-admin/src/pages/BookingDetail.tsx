import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Tag } from '../components/ui';
import QRCode from '../components/QRCode';
import { liveBookings, LiveApiError, type LiveBooking } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';

const TITLE = 'Booking detail';
const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');
const STATUS_TAG: Record<LiveBooking['status'], { label: string; cls: string }> = {
  refund_requested: { label: 'Refund req.', cls: 'tag-red' },
  confirmed: { label: 'Confirmed', cls: 'tag-green' },
  refunded: { label: 'Refunded', cls: 'tag-dim' },
  cancelled: { label: 'Cancelled', cls: '' },
};

const waLink = (phone: string, message: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;

/** Full booking detail — real fee breakdown, the actual signed QR the
 * guest's own ticket renders (not a lookalike), real refund actions against
 * BookingsService. */
export default function BookingDetail() {
  const { id } = useParams();
  const session = useLiveSession();
  const { token } = session;

  const [booking, setBooking] = useState<LiveBooking & { subtotal?: number; fee?: number; discount?: number; event: { title: string; date?: string; venue?: { city?: string } } } | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [waOpened, setWaOpened] = useState(false);

  const load = () => {
    if (!id) return;
    setLoading(true);
    setErr('');
    liveBookings
      .get(id)
      .then(setBooking)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  if (!loading && !booking) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Booking not found</h1>
        <Link to="/bookings" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Bookings</Link>
      </div>
    );
  }
  if (!booking) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const approveRefund = async () => {
    try {
      await liveBookings.approveRefund(booking.id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to approve refund');
    }
  };

  const declineRefund = async () => {
    try {
      await liveBookings.declineRefund(booking.id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to decline refund');
    }
  };

  const subtotal = booking.subtotal ?? 0;
  const fee = booking.fee ?? 0;
  const discount = booking.discount ?? 0;

  return (
    <div className="stack fade" style={{ maxWidth: 720, gap: 14 }}>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/bookings" style={{ fontSize: 13 }}>← Bookings</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{booking.id}</h1>
        <Tag {...STATUS_TAG[booking.status]} />
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Guest</div>
        <div className="tiny muted">{booking.user.name || booking.mainGuest} · {booking.whatsapp}</div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Event</div>
        <div className="tiny">
          <span>{booking.event.title}</span>
          {booking.event.venue?.city && <span className="muted"> · {booking.event.venue.city}</span>}
        </div>
        <div className="tiny muted">{booking.qty} × {booking.tierName} · paid via {booking.paymentMethod ? `manual (${booking.paymentMethod})` : 'online payment'}</div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Fee breakdown</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span className="muted">Subtotal</span><span>₹{fmt(subtotal)}</span>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span className="muted">Booking fee</span><span>₹{fmt(fee)}</span>
        </div>
        {discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span className="muted">Discount</span><span className="red">−₹{fmt(discount)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, paddingTop: 6, borderTop: '1px solid rgba(139,195,74,.15)' }}>
          <span>Paid</span><span className="green">₹{fmt(booking.total)}</span>
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="display" style={{ fontWeight: 700 }}>Guests on this booking ({booking.guests.length})</div>
        <div className="stack" style={{ gap: 4 }}>
          {booking.guests.map((g, i) => (
            <div
              key={g.name + i}
              style={{
                display: 'flex', gap: 8, alignItems: 'center',
                border: '1px solid rgba(139,195,74,.2)', borderRadius: 6, padding: '6px 9px', fontSize: 12,
              }}
            >
              <span className="muted">{i + 1}.</span>
              <span style={{ flex: 1, fontWeight: 700 }}>
                {g.name} {i === 0 && <span className="tiny muted" style={{ fontWeight: 400 }}>(main)</span>} {g.checkedIn && '✓'}
              </span>
              <span className="muted">{g.whatsapp ?? 'no phone on file'}</span>
            </div>
          ))}
        </div>
        <div className="tiny hint">full name and mobile number for every attendee — never masked for admin</div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div className="display" style={{ fontWeight: 700, alignSelf: 'flex-start' }}>Group entry QR</div>
        <QRCode value={booking.qrToken} caption={`valid for ${booking.guests.length} guest${booking.guests.length > 1 ? 's' : ''}`} />
        <div className="tiny hint">one QR covers the whole group — partial check-in supported at the gate</div>
      </div>

      {booking.status === 'refund_requested' && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ color: 'var(--red-soft)', fontSize: 12.5, fontWeight: 700 }}>↩ Refund requested — "can't attend"</div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-pri btn-sm" style={{ flex: 1 }} onClick={approveRefund}>
              Approve refund
            </button>
            <button className="btn btn-ghost btn-sm" style={{ flex: 1 }} onClick={declineRefund}>
              Decline
            </button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button
          className="btn btn-ghost btn-sm"
          onClick={() => {
            const msg = `Hey ${(booking.user.name || booking.mainGuest).split(' ')[0]}, resending your Prebooze ticket for ${booking.event.title} — booking ${booking.id}, ${booking.qty} × ticket. See you there! 🎟`;
            window.open(waLink(booking.whatsapp, msg), '_blank', 'noopener');
            setWaOpened(true);
          }}
        >
          Resend ticket via WhatsApp
        </button>
        {waOpened && <span className="tiny muted" style={{ alignSelf: 'center' }}>WhatsApp opened with the ticket message ✓</span>}
      </div>
    </div>
  );
}
