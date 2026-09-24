import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { organizer, type OrgBooking } from '../../api';
import { ApiError } from '../../api/client';
import { isEventOver, fmtMoney } from '../../data/mock';
import { partySizeFromTierName, isCoupleTierName } from '../../lib/partySize';
import { displayTierPrice } from '../../lib/ticketTierPricing';
import { usePlatformInfo } from '../../lib/usePlatformInfo';
import type { Event } from '../../types';
import { ArrowLeft, Send, CheckCircle2, Copy, Minus, Plus } from 'lucide-react';

const GENDERS = ['Male', 'Female', 'Other'];

/** Walk-up/phone/gate-inquiry booking, created directly from the organizer
 * console — see BookingsService.createOfflineBookingSelfCollected/
 * PaymentLink for the real design (2026-09-24). Two payment modes: the
 * organizer already has the guest's cash/UPI in hand ("self-collected",
 * confirms immediately), or a real PhonePe payment link texted to the
 * guest's WhatsApp ("payment link", confirms once they actually pay —
 * same webhook every online checkout already uses). Prebooze takes a flat
 * 2% commission on either (from the organizer's payout, not the guest),
 * plus the same guest-facing booking fee + GST every online checkout
 * already charges — see the price breakdown below.
 *
 * A full page, not a modal (2026-09-25) — the modal didn't scroll properly
 * on mobile and its cramped width squeezed the qty stepper and price
 * breakdown together; a page gets normal document scroll and room to
 * breathe, same reasoning as Checkout.tsx being its own page rather than
 * a popover. */
export default function OfflineBooking() {
  const navigate = useNavigate();
  const { bookingFee, gstPct: platformGstPct } = usePlatformInfo();
  const [events, setEvents] = useState<Event[]>([]);
  const [loadingEvents, setLoadingEvents] = useState(true);
  const [eventId, setEventId] = useState('');
  const [tierId, setTierId] = useState('');
  const [qty, setQty] = useState(1);
  const [guestName, setGuestName] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [gender, setGender] = useState('');
  const [others, setOthers] = useState<{ name: string; gender: string }[]>([]);
  const [paymentMode, setPaymentMode] = useState<'self_collected' | 'payment_link'>('self_collected');
  const [submitting, setSubmitting] = useState(false);
  const [err, setErr] = useState('');
  const [linkResult, setLinkResult] = useState<{ redirectUrl: string; total: number } | null>(null);
  const [selfResult, setSelfResult] = useState<OrgBooking | null>(null);

  useEffect(() => {
    organizer.offlineBookingEvents()
      .then((all) => setEvents(all.filter((e) => e.status === 'approved' && !isEventOver(e))))
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Could not load your events'))
      .finally(() => setLoadingEvents(false));
  }, []);

  const event = events.find((e) => e.id === eventId);
  const tier = event?.tiers.find((t) => t.id === tierId);
  const partySize = tier ? partySizeFromTierName(tier.name) : 1;
  const extraNeeded = tier ? Math.max(0, qty * partySize - 1) : 0;
  const tierPrice = tier && event ? displayTierPrice(tier, event.date) : 0;
  const subtotal = tierPrice * qty;
  // Preview only — same formula as the backend's real computation
  // (prepareOfflineBooking), just done client-side off the same public
  // platform settings Checkout.tsx already uses, so what's shown here
  // matches what's actually charged.
  const fee = subtotal > 0 ? Math.round((subtotal * bookingFee) / 100) : 0;
  const gst = Math.round((fee * platformGstPct) / 100);
  const total = subtotal + fee + gst;
  const maxQty = tier ? tier.quantity - tier.sold : 1;

  useEffect(() => {
    setOthers((prev) => {
      const next = [...prev];
      while (next.length < extraNeeded) next.push({ name: '', gender: '' });
      return next.slice(0, extraNeeded);
    });
  }, [extraNeeded]);

  const canSubmit = eventId && tierId && qty >= 1 && guestName.trim() && whatsapp.trim() && !submitting;

  const submit = async () => {
    if (!tier || !event) return;
    setErr('');
    setSubmitting(true);
    try {
      const body = {
        eventId, tierId, qty, guestName: guestName.trim(), whatsapp: whatsapp.trim(), gender: gender || undefined,
        others: others.map((o) => ({ name: o.name.trim(), gender: o.gender || undefined })).filter((o) => o.name),
        paymentMode,
      };
      const res = await organizer.createOfflineBooking(body);
      if (paymentMode === 'payment_link') {
        const r = res as { redirectUrl: string; total: number };
        setLinkResult(r);
      } else {
        const b = res as OrgBooking;
        setSelfResult(b);
      }
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not create this booking');
    } finally {
      setSubmitting(false);
    }
  };

  // Couple tiers need exactly one Male + one Female per pair, same door
  // policy the real guest checkout enforces — kept as a soft nudge here
  // (not a hard block), since an organizer entering this on someone's
  // behalf is already the real-world verification, same trust level as
  // every other offline detail on this form.
  const coupleHint = tier && isCoupleTierName(tier.name);

  return (
    <div style={{ maxWidth: 560 }}>
      <div className="breadcrumb" style={{ marginBottom: 16 }}>
        <Link to="/organizer/bookings" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
          <ArrowLeft size={13} /> Bookings
        </Link> / Offline booking
      </div>

      <div className="card card-shadow">
        <h1 style={{ fontSize: 22, marginBottom: 4 }}>Offline booking</h1>
        <p className="tiny muted-2" style={{ marginBottom: 18 }}>
          For a walk-up, phone, or gate inquiry — enter the guest's details, then either confirm it yourself
          (you've already got their payment) or text them a real payment link.
        </p>

        {linkResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="tiny" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent)' }}>
              <Send size={14} /> Payment link sent to {whatsapp}
            </div>
            <div className="muted small">
              {fmtMoney(linkResult.total)} — the booking confirms automatically the moment they pay, and they'll get their ticket the
              same way as any other booking. You can also copy the link below if WhatsApp delivery doesn't land.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input readOnly value={linkResult.redirectUrl} style={{ flex: 1, fontSize: 12 }} onFocus={(e) => e.target.select()} />
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(linkResult.redirectUrl)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Copy size={13} /> Copy
              </button>
            </div>
            <button className="btn btn-pri" onClick={() => navigate('/organizer/bookings')}>Done</button>
          </div>
        ) : selfResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="tiny" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--green, #4caf50)' }}>
              <CheckCircle2 size={14} /> Booking confirmed — {selfResult.id}
            </div>
            <div className="muted small">Ticket sent to {whatsapp}. Prebooze's cut (2% commission + booking fee + GST) will show under Payouts → Offline booking charges.</div>
            <button className="btn btn-pri" onClick={() => navigate('/organizer/bookings')}>Done</button>
          </div>
        ) : (
          <>
            {err && <div className="danger-text small" style={{ marginBottom: 10 }}>{err}</div>}
            <div className="field" style={{ marginBottom: 14 }}>
              <span>Event</span>
              <select value={eventId} onChange={(e) => { setEventId(e.target.value); setTierId(''); }} disabled={loadingEvents || (!loadingEvents && !err && events.length === 0)}>
                <option value="">{loadingEvents ? 'Loading…' : events.length === 0 && !err ? 'No live events' : 'Pick an event'}</option>
                {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
            {event && event.tiers.length === 0 && (
              <div className="tiny muted-2" style={{ marginBottom: 14 }}>This event has no ticket tiers set up yet.</div>
            )}
            {event && event.tiers.length > 0 && (
              <div className="field" style={{ marginBottom: 14 }}>
                <span>Ticket tier</span>
                <select value={tierId} onChange={(e) => { setTierId(e.target.value); setQty(1); }}>
                  <option value="">Pick a tier</option>
                  {event.tiers.map((t) => (
                    <option key={t.id} value={t.id} disabled={t.quantity - t.sold < 1}>
                      {t.name} — {fmtMoney(displayTierPrice(t, event.date))} ({t.quantity - t.sold} left)
                    </option>
                  ))}
                </select>
              </div>
            )}

            {tier && (
              <div className="field" style={{ marginBottom: 14 }}>
                <span>Quantity</span>
                <div className="qty-stepper">
                  <button type="button" className="qty-stepper-btn" disabled={qty <= 1} onClick={() => setQty((q) => Math.max(1, q - 1))} aria-label="Decrease quantity">
                    <Minus size={15} />
                  </button>
                  <span className="qty-stepper-value">{qty}</span>
                  <button type="button" className="qty-stepper-btn" disabled={qty >= maxQty} onClick={() => setQty((q) => Math.min(maxQty, q + 1))} aria-label="Increase quantity">
                    <Plus size={15} />
                  </button>
                </div>
              </div>
            )}

            {tier && (
              <div className="card" style={{ background: 'var(--bg-2, rgba(255,255,255,.03))', marginBottom: 14, padding: 14 }}>
                <div className="tiny muted-2" style={{ marginBottom: 8 }}>Price breakdown</div>
                <div style={{ display: 'grid', gap: 6, fontSize: 13.5 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="muted">{qty} × {tier.name} ({fmtMoney(tierPrice)})</span>
                    <span>{fmtMoney(subtotal)}</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span className="muted">Booking fee</span>
                    <span>{fmtMoney(fee)}</span>
                  </div>
                  {gst > 0 && (
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span className="muted">GST ({platformGstPct}% on fee)</span>
                      <span>{fmtMoney(gst)}</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid var(--border-dash, rgba(255,255,255,.1))', paddingTop: 6, marginTop: 2, fontWeight: 700 }}>
                    <span>Total {paymentMode === 'self_collected' ? 'to collect' : 'guest pays'}</span>
                    <span>{total > 0 ? fmtMoney(total) : 'Free'}</span>
                  </div>
                </div>
                {extraNeeded > 0 && (
                  <div className="tiny muted-2" style={{ marginTop: 8 }}>
                    {tier.name} needs {qty * partySize} names total{coupleHint ? ' — one Male, one Female per pair' : ''}.
                  </div>
                )}
              </div>
            )}

            <div className="form-row" style={{ marginBottom: 14 }}>
              <div className="field" style={{ marginBottom: 0 }}>
                <span>Guest name</span>
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Main guest" />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <span>Gender</span>
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">—</option>
                  {GENDERS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="field" style={{ marginBottom: 14 }}>
              <span>Guest WhatsApp number</span>
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+91 9XXXXXXXXX" />
            </div>

            {others.length > 0 && (
              <div style={{ marginBottom: 14 }}>
                <div className="tiny muted-2" style={{ marginBottom: 6 }}>Other guests in this booking</div>
                {others.map((o, i) => (
                  <div key={i} className="form-row" style={{ marginBottom: 8 }}>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <span>Guest {i + 2} name</span>
                      <input value={o.name} onChange={(e) => setOthers((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder="Name" />
                    </div>
                    <div className="field" style={{ marginBottom: 0 }}>
                      <span>Gender</span>
                      <select value={o.gender} onChange={(e) => setOthers((prev) => prev.map((x, j) => (j === i ? { ...x, gender: e.target.value } : x)))}>
                        <option value="">—</option>
                        {GENDERS.map((g) => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="field" style={{ marginBottom: 18 }}>
              <span>Payment</span>
              <div className="chip-row">
                <button type="button" className={`chip ${paymentMode === 'self_collected' ? 'on' : ''}`} onClick={() => setPaymentMode('self_collected')}>
                  I already have their payment
                </button>
                <button type="button" className={`chip ${paymentMode === 'payment_link' ? 'on' : ''}`} onClick={() => setPaymentMode('payment_link')} disabled={subtotal <= 0}>
                  Send a payment link
                </button>
              </div>
              <div className="tiny muted-2" style={{ marginTop: 6 }}>
                {paymentMode === 'self_collected'
                  ? "Booking confirms right away. Prebooze's cut is deducted from your next payout."
                  : 'A real PhonePe link is texted to the guest — the booking confirms once they pay.'}
              </div>
            </div>

            <button className="btn btn-pri btn-block" disabled={!canSubmit} onClick={submit}>
              {submitting ? 'Creating…' : paymentMode === 'payment_link' ? 'Send payment link →' : 'Confirm booking →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
