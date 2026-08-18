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
const REFUND_METHOD_LABEL: Record<string, string> = { wallet: 'Prebooze wallet', source: 'original payment method' };

const waLink = (phone: string, message: string) => `https://wa.me/${phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' });
const fmtDuration = (hrs: number) => {
  const h = Math.floor(hrs);
  const m = Math.round((hrs - h) * 60);
  return m > 0 ? `${h}h ${m}m` : `${h}h`;
};

/** Full booking detail — real fee breakdown, the actual signed QR the
 * guest's own ticket renders (not a lookalike), real refund actions against
 * BookingsService. */
export default function BookingDetail() {
  const { id } = useParams();
  const session = useLiveSession();
  const { token } = session;

  type FullBooking = LiveBooking & {
    subtotal?: number; fee?: number; discount?: number; couponCode?: string | null;
    event: { title: string; date?: string; durationHrs?: number; venue?: { name?: string; city?: string } };
  };
  const [booking, setBooking] = useState<FullBooking | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [waOpened, setWaOpened] = useState(false);
  const [emailSent, setEmailSent] = useState(false);
  const [emailErr, setEmailErr] = useState('');
  const [showTicket, setShowTicket] = useState(false);
  const [note, setNote] = useState('');
  const [noteSaved, setNoteSaved] = useState(false);
  const [otherBookings, setOtherBookings] = useState<LiveBooking[] | null>(null);

  const load = () => {
    if (!id) return;
    setLoading(true);
    setErr('');
    liveBookings
      .get(id)
      .then((b) => { setBooking(b); setNote(b.adminNote ?? ''); })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, id]);

  useEffect(() => {
    if (!booking) return;
    liveBookings.list(undefined, booking.userId)
      .then((rows) => setOtherBookings(rows.filter((b) => b.id !== booking.id)))
      .catch(() => setOtherBookings([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [booking?.id, booking?.userId]);

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

  const resendEmail = async () => {
    setEmailErr('');
    try {
      await liveBookings.resendEmail(booking.id);
      setEmailSent(true);
    } catch (e) {
      setEmailErr(e instanceof LiveApiError ? e.message : 'Failed to resend email');
    }
  };

  const saveNote = async () => {
    try {
      await liveBookings.setNote(booking.id, note);
      setNoteSaved(true);
      setTimeout(() => setNoteSaved(false), 2000);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save note');
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
        <div className="tiny muted">
          <Link to={`/customers/${booking.userId}`}>{booking.user.name || booking.mainGuest}</Link> · {booking.whatsapp}
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Event</div>
        <div className="tiny">
          <span>{booking.event.title}</span>
          {booking.event.venue?.name && <span className="muted"> · {booking.event.venue.name}</span>}
          {booking.event.venue?.city && <span className="muted"> · {booking.event.venue.city}</span>}
        </div>
        {booking.event.date && (
          <div className="tiny muted">
            {fmtDate(booking.event.date)} · {fmtTime(booking.event.date)}
            {booking.event.durationHrs ? ` · ${fmtDuration(booking.event.durationHrs)}` : ''}
          </div>
        )}
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
            <span className="muted">Discount{booking.couponCode ? ` (${booking.couponCode})` : ''}</span><span className="red">−₹{fmt(discount)}</span>
          </div>
        )}
        {booking.walletCreditUsed > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span className="muted">Wallet credit used</span><span className="red">−₹{fmt(booking.walletCreditUsed)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, paddingTop: 6, borderTop: '1px solid rgba(139,195,74,.15)' }}>
          <span>Paid</span><span className="green">₹{fmt(booking.total)}</span>
        </div>
        {booking.paymentId && <div className="tiny hint">Razorpay ref: {booking.paymentId}</div>}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="display" style={{ fontWeight: 700 }}>
          Guests on this booking ({booking.guests.length}) · {booking.guests.filter((g) => g.checkedIn).length} checked in
        </div>
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
                {g.name} {i === 0 && <span className="tiny muted" style={{ fontWeight: 400 }}>(main)</span>}
              </span>
              <span className="muted">{(i === 0 ? g.whatsapp ?? booking.whatsapp : g.whatsapp) ?? 'no phone on file'}</span>
              <Tag {...(g.checkedIn ? { label: 'Checked in', cls: 'tag-green' } : { label: 'Not checked in', cls: 'tag-dim' })} />
            </div>
          ))}
        </div>
        <div className="tiny hint">full name and mobile number for every attendee — never masked for admin</div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Timeline</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span className="muted">Booked</span><span>{fmtDateTime(booking.createdAt)}</span>
        </div>
        {booking.checkedInAt && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span className="muted">QR first scanned</span><span>{fmtDateTime(booking.checkedInAt)}</span>
          </div>
        )}
        {booking.status === 'refunded' && booking.refundedTo && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
            <span className="muted">Refunded to</span><span>{REFUND_METHOD_LABEL[booking.refundedTo] ?? booking.refundedTo}</span>
          </div>
        )}
      </div>

      {booking.promoter && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div className="display" style={{ fontWeight: 700 }}>Promoter attribution</div>
          <div className="tiny">
            <Link to={`/promoters/${booking.promoter.id}`}>{booking.promoter.name}</Link>
            {booking.promoterVia && <span className="muted"> via {booking.promoterVia}</span>}
          </div>
          <div className="tiny muted">Commission earned: ₹{fmt(booking.promoterCommission)}</div>
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
        <div className="display" style={{ fontWeight: 700, alignSelf: 'flex-start' }}>Group entry QR</div>
        <QRCode value={booking.qrToken} caption={`valid for ${booking.guests.length} guest${booking.guests.length > 1 ? 's' : ''}`} />
        <div className="tiny hint">one QR covers the whole group — partial check-in supported at the gate</div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowTicket((v) => !v)}>
          {showTicket ? 'Hide ticket details' : 'View ticket details'}
        </button>
        {showTicket && (
          <div className="card" style={{ width: '100%', gap: 4, display: 'flex', flexDirection: 'column', background: 'rgba(139,195,74,.05)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="muted">Booking ID</span><span>{booking.id}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="muted">Event</span><span>{booking.event.title}</span></div>
            {booking.event.date && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="muted">Date &amp; time</span><span>{fmtDate(booking.event.date)} · {fmtTime(booking.event.date)}</span>
              </div>
            )}
            {(booking.event.venue?.name || booking.event.venue?.city) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
                <span className="muted">Venue</span><span>{[booking.event.venue?.name, booking.event.venue?.city].filter(Boolean).join(', ')}</span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="muted">Tier</span><span>{booking.qty} × {booking.tierName}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}><span className="muted">Main guest</span><span>{booking.mainGuest}</span></div>
          </div>
        )}
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

      {otherBookings && otherBookings.length > 0 && (
        <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div className="display" style={{ fontWeight: 700 }}>This guest's other bookings ({otherBookings.length})</div>
          <div className="stack" style={{ gap: 4 }}>
            {otherBookings.map((b) => (
              <Link
                key={b.id}
                to={`/bookings/${encodeURIComponent(b.id)}`}
                style={{
                  display: 'flex', justifyContent: 'space-between', gap: 8,
                  border: '1px solid rgba(139,195,74,.2)', borderRadius: 6, padding: '6px 9px', fontSize: 12,
                }}
              >
                <span>{b.event.title}</span>
                <span className="muted">{fmtDate(b.createdAt)} · <Tag {...STATUS_TAG[b.status]} /></span>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div className="display" style={{ fontWeight: 700 }}>Staff note</div>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. guest called, ticket resent manually — internal only, never shown to the guest"
          rows={3}
          style={{ width: '100%', resize: 'vertical', fontFamily: 'inherit', fontSize: 13, padding: 8, borderRadius: 6, background: 'var(--surface-2)', border: '1px solid rgba(139,195,74,.2)', color: 'inherit' }}
        />
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button className="btn btn-pri btn-sm" onClick={saveNote} disabled={note === (booking.adminNote ?? '')}>
            Save note
          </button>
          {noteSaved && <span className="tiny muted">Saved ✓</span>}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
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
        {waOpened && <span className="tiny muted">WhatsApp opened with the ticket message ✓</span>}
        <button className="btn btn-ghost btn-sm" onClick={resendEmail}>
          Resend ticket via email
        </button>
        {emailSent && <span className="tiny muted">Email sent ✓</span>}
        {emailErr && <span className="tiny" style={{ color: 'var(--red)' }}>{emailErr}</span>}
      </div>
    </div>
  );
}
