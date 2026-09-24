import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { organizer, type OrgBookingDetail } from '../../api';
import { ApiError } from '../../api/client';
import QRCode from '../../components/QRCode';
import { fmtMoney } from '../../data/mock';
import { ArrowLeft, CheckCircle2, RefreshCw, AlertTriangle, Undo2, Send, Ban } from 'lucide-react';

const STATUS_TAG: Record<OrgBookingDetail['status'], { label: string; cls: string }> = {
  refund_requested: { label: 'Refund req.', cls: 'badge-danger' },
  confirmed: { label: 'Confirmed', cls: 'badge-pending' },
  refunded: { label: 'Refunded', cls: 'badge' },
  cancelled: { label: 'Cancelled', cls: 'badge' },
};
const REFUND_METHOD_LABEL: Record<string, string> = { wallet: 'Prebooze wallet', source: 'original payment method' };
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const fmtDateTime = (iso: string) => new Date(iso).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' });
const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' });

/** Organizer-scoped booking detail — same fee breakdown / guest list /
 * refund-state / promoter attribution / entry QR admin staff already see
 * via BookingDetail.tsx, minus admin-only actions (refund approve/decline/
 * retry stay admin-only — an organizer can see refund status here, not act
 * on it) and minus the internal staff note. Real gap this closes: neither
 * this app nor the RN organizer app had ANY single-booking detail view at
 * all before this — both were list-only, so an organizer fielding a
 * guest's question about their own booking had strictly less info than
 * admin staff would (2026-09-24). */
export default function BookingDetail() {
  const { id } = useParams();
  const [booking, setBooking] = useState<OrgBookingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [actionErr, setActionErr] = useState('');
  const [resending, setResending] = useState(false);
  const [resent, setResent] = useState(false);
  const [voiding, setVoiding] = useState(false);
  const [confirmVoid, setConfirmVoid] = useState(false);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    organizer
      .bookingDetail(id)
      .then(setBooking)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load booking'))
      .finally(() => setLoading(false));
  }, [id]);

  const doResend = async () => {
    if (!id) return;
    setResending(true);
    setActionErr('');
    try {
      await organizer.resendOfflineBooking(id);
      setResent(true);
    } catch (e) {
      setActionErr(e instanceof ApiError ? e.message : 'Could not resend');
    } finally {
      setResending(false);
    }
  };

  const doVoid = async () => {
    if (!id) return;
    setVoiding(true);
    setActionErr('');
    try {
      const updated = await organizer.voidOfflineBooking(id);
      setBooking((prev) => (prev ? { ...prev, status: updated.status } : prev));
      setConfirmVoid(false);
    } catch (e) {
      setActionErr(e instanceof ApiError ? e.message : 'Could not void this booking');
    } finally {
      setVoiding(false);
    }
  };

  if (loading) return <div className="stack fade"><div className="muted small">Loading…</div></div>;
  if (!booking) {
    return (
      <div className="stack fade" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {err && <div className="danger-text small">{err}</div>}
        <h1 className="page-title">Booking not found</h1>
        <Link to="/organizer/bookings" className="btn btn-ghost btn-sm" style={{ width: 'fit-content', display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={13} /> Bookings</Link>
      </div>
    );
  }

  return (
    <div className="stack fade" style={{ display: 'flex', flexDirection: 'column', maxWidth: 720, gap: 14 }}>
      {err && <div className="danger-text small">{err}</div>}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/organizer/bookings" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={13} /> Bookings</Link>
        <h1 className="display" style={{ fontSize: 18 }}>{booking.id}</h1>
        <span className={`badge ${STATUS_TAG[booking.status].cls}`}>{STATUS_TAG[booking.status].label}</span>
      </div>

      {booking.bookingSource === 'offline' && (
        <div className="card tbl-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
          {actionErr && <div className="danger-text small">{actionErr}</div>}
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
            <button className="btn btn-ghost btn-sm" disabled={resending} onClick={doResend} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Send size={13} /> {resending ? 'Resending…' : resent ? 'Resent ✓' : 'Resend to WhatsApp'}
            </button>
            {booking.offlinePaymentMode === 'self_collected' && booking.status === 'confirmed' && !confirmVoid && (
              <button className="btn btn-ghost btn-sm" onClick={() => setConfirmVoid(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--danger)' }}>
                <Ban size={13} /> Void this booking
              </button>
            )}
          </div>
          {confirmVoid && (
            <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12 }}>
              <div className="small bold" style={{ marginBottom: 6 }}>Void this booking?</div>
              <p className="tiny muted-2" style={{ marginBottom: 10 }}>
                Frees up the tier inventory and credits back the 2% commission + booking fee + GST Prebooze charged on it.
                This does NOT refund the guest — you're voiding it because they never showed up or it was a mistake, and
                you're keeping (or already returned) their cash yourself.
              </p>
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn btn-danger btn-sm" disabled={voiding} onClick={doVoid}>{voiding ? 'Voiding…' : 'Yes, void it'}</button>
                <button className="btn btn-ghost btn-sm" disabled={voiding} onClick={() => setConfirmVoid(false)}>Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="card tbl-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
        <div className="display" style={{ fontWeight: 700 }}>Guest</div>
        <div className="tiny muted">{booking.user.name || booking.mainGuest} · {booking.whatsapp}{booking.user.email ? ` · ${booking.user.email}` : ''}</div>
      </div>

      <div className="card tbl-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 10, padding: 14 }}>
        <div className="display" style={{ fontWeight: 700 }}>Event</div>
        <div className="tiny">
          <span>{booking.event.title}</span>
          {booking.event.venue?.name && <span className="muted"> · {booking.event.venue.name}</span>}
          {booking.event.venue?.city && <span className="muted"> · {booking.event.venue.city}</span>}
        </div>
        {booking.event.date && (
          <div className="tiny muted">{fmtDate(booking.event.date)} · {fmtTime(booking.event.date)}</div>
        )}
        <div className="tiny muted">
          {booking.qty} × {booking.tierName} · paid via{' '}
          {booking.bookingSource === 'offline'
            ? (booking.offlinePaymentMode === 'self_collected' ? 'offline — paid to organizer directly' : 'offline — paid via WhatsApp link')
            : (booking.paymentMethod ? `manual (${booking.paymentMethod})` : 'online payment')}
        </div>
      </div>

      <div className="card tbl-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14 }}>
        <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Fee breakdown</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span className="muted">Subtotal</span><span>{fmtMoney(booking.subtotal)}</span></div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span className="muted">Booking fee</span><span>{fmtMoney(booking.fee)}</span></div>
        {booking.discount > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span className="muted">Discount{booking.couponCode ? ` (${booking.couponCode})` : ''}</span><span className="danger-text">−{fmtMoney(booking.discount)}</span></div>
        )}
        {booking.walletCreditUsed > 0 && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span className="muted">Wallet credit used</span><span className="danger-text">−{fmtMoney(booking.walletCreditUsed)}</span></div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 14, fontWeight: 700, paddingTop: 6, borderTop: '1px solid rgba(139,195,74,.15)' }}>
          <span>Paid</span><span className="accent">{fmtMoney(booking.total)}</span>
        </div>
      </div>

      <div className="card tbl-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
        <div className="display" style={{ fontWeight: 700 }}>
          Guests on this booking ({booking.guests.length}) · {booking.guests.filter((g) => g.checkedIn).length} checked in
        </div>
        {booking.guests.map((g, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center', border: '1px solid rgba(139,195,74,.2)', borderRadius: 6, padding: '6px 9px', fontSize: 12 }}>
            <span className="muted">{i + 1}.</span>
            <span style={{ flex: 1, fontWeight: i === 0 ? 700 : 400 }}>{g.name}{i === 0 && <span className="tiny muted" style={{ fontWeight: 400 }}> (main)</span>}</span>
            <span className="muted">{g.whatsapp ?? booking.whatsapp}</span>
            <span className={`badge ${g.checkedIn ? 'badge-ok' : ''}`}>{g.checkedIn ? 'Checked in' : 'Not checked in'}</span>
          </div>
        ))}
      </div>

      <div className="card tbl-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14 }}>
        <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Timeline</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span className="muted">Booked</span><span>{fmtDateTime(booking.createdAt)}</span></div>
        {booking.checkedInAt && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span className="muted">QR first scanned</span><span>{fmtDateTime(booking.checkedInAt)}</span></div>
        )}
        {booking.status === 'refunded' && booking.refundedTo && (
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}><span className="muted">Refunded to</span><span>{REFUND_METHOD_LABEL[booking.refundedTo] ?? booking.refundedTo}</span></div>
        )}
      </div>

      {booking.promoter && (
        <div className="card tbl-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14 }}>
          <div className="display" style={{ fontWeight: 700 }}>Promoter attribution</div>
          <div className="tiny">{booking.promoter.name}</div>
          <div className="tiny muted">Commission earned: {fmtMoney(booking.promoterCommission)}</div>
        </div>
      )}

      <div className="card tbl-wrap" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, padding: 14 }}>
        <div className="display" style={{ fontWeight: 700, alignSelf: 'flex-start' }}>Group entry QR</div>
        <QRCode value={booking.qrToken} caption={`valid for ${booking.guests.length} guest${booking.guests.length > 1 ? 's' : ''}`} />
        <div className="tiny hint">one QR covers the whole group — partial check-in supported at the gate</div>
      </div>

      {booking.status === 'refund_requested' && (
        <div className="card tbl-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
          <div className="danger-text" style={{ fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Undo2 size={14} /> Refund requested — "can't attend"</div>
          <div className="tiny muted">Awaiting admin review — refund approvals happen on the Prebooze admin side, not here.</div>
        </div>
      )}

      {booking.refundGatewayState === 'INITIATED' && (
        <div className="card tbl-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14 }}>
          <div className="accent" style={{ fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><RefreshCw size={14} /> Refund in progress on the gateway</div>
          <div className="tiny muted">
            {fmtMoney(booking.refundGatewayAmount ?? booking.total)} is being processed by the payment gateway right now.
            {booking.refundGatewayRefundId && <> Refund ID: <code>{booking.refundGatewayRefundId}</code>.</>}
          </div>
        </div>
      )}

      {booking.refundGatewayState === 'COMPLETED' && !booking.refundFailedAt && (
        <div className="card tbl-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: 14 }}>
          <div className="accent" style={{ fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} /> Refund completed</div>
          <div className="tiny muted">{fmtMoney(booking.refundGatewayAmount ?? booking.total)} confirmed by the gateway — the guest has been paid back.</div>
        </div>
      )}

      {booking.refundFailedAt && booking.refundGatewayState !== 'INITIATED' && (
        <div className="card tbl-wrap" style={{ display: 'flex', flexDirection: 'column', gap: 8, padding: 14 }}>
          <div className="danger-text" style={{ fontSize: 12.5, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 6 }}><AlertTriangle size={14} /> Refund to original payment method failed</div>
          <div className="tiny muted">
            The payout to the guest's card/UPI/bank hasn't gone through yet (failed {fmtDateTime(booking.refundFailedAt)}). This is being retried on the admin side.
          </div>
        </div>
      )}
    </div>
  );
}
