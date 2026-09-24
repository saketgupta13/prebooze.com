import { useEffect, useState } from 'react';
import { organizer, type OrgBooking } from '../../api';
import { ApiError } from '../../api/client';
import { isEventOver, fmtMoney } from '../../data/mock';
import { partySizeFromTierName, isCoupleTierName } from '../../lib/partySize';
import { displayTierPrice } from '../../lib/ticketTierPricing';
import type { Event } from '../../types';
import { X, Send, CheckCircle2, Copy } from 'lucide-react';

const GENDERS = ['Male', 'Female', 'Other'];

/** Walk-up/phone/gate-inquiry booking, created directly from the organizer
 * console — see BookingsService.createOfflineBookingSelfCollected/
 * PaymentLink for the real design (2026-09-24). Two payment modes: the
 * organizer already has the guest's cash/UPI in hand ("self-collected",
 * confirms immediately), or a real PhonePe payment link texted to the
 * guest's WhatsApp ("payment link", confirms once they actually pay —
 * same webhook every online checkout already uses). Prebooze takes a flat
 * 2% on either, separate from whatever this event's own online rate is —
 * see the Payouts page's "Offline booking charges" section for exactly
 * what that came to per booking. */
export default function OfflineBookingModal({ onClose, onCreated }: { onClose: () => void; onCreated: (b: OrgBooking) => void }) {
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
  const [linkResult, setLinkResult] = useState<{ redirectUrl: string; subtotal: number } | null>(null);
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
        const r = res as { redirectUrl: string; subtotal: number };
        setLinkResult(r);
      } else {
        const b = res as OrgBooking;
        setSelfResult(b);
        onCreated(b);
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
    <div className="modal-ov" onClick={onClose}>
      <div className="card card-shadow" style={{ maxWidth: 480, width: '100%' }} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Offline booking</h3>
          <X size={18} style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>

        {linkResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="tiny" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--accent)' }}>
              <Send size={14} /> Payment link sent to {whatsapp}
            </div>
            <div className="muted small">
              ₹{fmtMoney(linkResult.subtotal)} — the booking confirms automatically the moment they pay, and they'll get their ticket the
              same way as any other booking. You can also copy the link below if WhatsApp delivery doesn't land.
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input readOnly value={linkResult.redirectUrl} style={{ flex: 1, fontSize: 12 }} onFocus={(e) => e.target.select()} />
              <button className="btn btn-ghost btn-sm" onClick={() => navigator.clipboard.writeText(linkResult.redirectUrl)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                <Copy size={13} /> Copy
              </button>
            </div>
            <button className="btn btn-pri" onClick={onClose}>Done</button>
          </div>
        ) : selfResult ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="tiny" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--green, #4caf50)' }}>
              <CheckCircle2 size={14} /> Booking confirmed — {selfResult.id}
            </div>
            <div className="muted small">Ticket sent to {whatsapp}. Prebooze's 2% (₹{fmtMoney(Math.round(subtotal * 0.02))}) will show under Payouts → Offline booking charges.</div>
            <button className="btn btn-pri" onClick={onClose}>Done</button>
          </div>
        ) : (
          <>
            {err && <div className="danger-text small" style={{ marginBottom: 10 }}>{err}</div>}
            <div className="field" style={{ marginBottom: 10 }}>
              <span>Event</span>
              <select value={eventId} onChange={(e) => { setEventId(e.target.value); setTierId(''); }} disabled={loadingEvents || (!loadingEvents && !err && events.length === 0)}>
                <option value="">{loadingEvents ? 'Loading…' : events.length === 0 && !err ? 'No live events' : 'Pick an event'}</option>
                {events.map((e) => <option key={e.id} value={e.id}>{e.title}</option>)}
              </select>
            </div>
            {event && event.tiers.length === 0 && (
              <div className="tiny muted-2" style={{ marginBottom: 10 }}>This event has no ticket tiers set up yet.</div>
            )}
            {event && event.tiers.length > 0 && (
              <div className="field" style={{ marginBottom: 10 }}>
                <span>Ticket tier</span>
                <select value={tierId} onChange={(e) => setTierId(e.target.value)}>
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
              <div className="form-row" style={{ marginBottom: 10 }}>
                <div className="field" style={{ flex: '0 0 90px' }}>
                  <span>Qty</span>
                  <input type="number" min={1} max={tier.quantity - tier.sold} value={qty} onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <span>Total</span>
                  <div style={{ padding: '8px 0', fontWeight: 700 }}>{subtotal > 0 ? fmtMoney(subtotal) : 'Free'}</div>
                </div>
              </div>
            )}

            <div className="form-row" style={{ marginBottom: 10 }}>
              <div className="field">
                <span>Guest name</span>
                <input value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Main guest" />
              </div>
              <div className="field" style={{ flex: '0 0 120px' }}>
                <span>Gender</span>
                <select value={gender} onChange={(e) => setGender(e.target.value)}>
                  <option value="">—</option>
                  {GENDERS.map((g) => <option key={g}>{g}</option>)}
                </select>
              </div>
            </div>
            <div className="field" style={{ marginBottom: 10 }}>
              <span>Guest WhatsApp number</span>
              <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+91 9XXXXXXXXX" />
            </div>

            {others.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <div className="tiny muted-2" style={{ marginBottom: 6 }}>
                  {tier?.name} needs {qty * partySize} names total{coupleHint ? ' — one Male, one Female per pair' : ''}.{' '}
                  {qty} × {fmtMoney(tierPrice)} = {fmtMoney(subtotal)} total, covering all {qty * partySize} guests.
                </div>
                {others.map((o, i) => (
                  <div key={i} className="form-row" style={{ marginBottom: 6 }}>
                    <div className="field">
                      <input value={o.name} onChange={(e) => setOthers((prev) => prev.map((x, j) => (j === i ? { ...x, name: e.target.value } : x)))} placeholder={`Guest ${i + 2} name`} />
                    </div>
                    <div className="field" style={{ flex: '0 0 120px' }}>
                      <select value={o.gender} onChange={(e) => setOthers((prev) => prev.map((x, j) => (j === i ? { ...x, gender: e.target.value } : x)))}>
                        <option value="">—</option>
                        {GENDERS.map((g) => <option key={g}>{g}</option>)}
                      </select>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="field" style={{ marginBottom: 14 }}>
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
                  ? 'Booking confirms right away. Prebooze\'s 2% is deducted from your next payout.'
                  : 'A real PhonePe link is texted to the guest — the booking confirms once they pay.'}
              </div>
            </div>

            <button className="btn btn-pri" disabled={!canSubmit} onClick={submit}>
              {submitting ? 'Creating…' : paymentMode === 'payment_link' ? 'Send payment link →' : 'Confirm booking →'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
