import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Check } from 'lucide-react';
import { fmt } from '../store/data';
import { liveEvents, liveSettings, liveManualBooking, LiveApiError, type LiveEvent } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';
import { partySizeFromTierName } from '../lib/partySize';

const TITLE = 'Manual booking';

/** Manual booking — phone orders, walk-ups and comps recorded by the team.
 * Creates a genuine Booking (BookingsService.adminCreate) — real inventory
 * decrement, real organizer ledger credit, real invoice, real WhatsApp
 * confirmation, not a mock record.
 *
 * Real gap closed 2026-09-28: this used to lock a booking to exactly ONE
 * tier (a single chip selector) — a mixed order like "2 Male + 1 Female"
 * couldn't be recorded as one booking. Now a per-tier qty stepper list,
 * same lines[] model prebooze-web's OfflineBooking.tsx and guest
 * checkout's EventDetail.tsx both use. */
export default function ManualBooking() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();

  const [approvedEvents, setApprovedEvents] = useState<LiveEvent[]>([]);
  const [bookingFee, setBookingFee] = useState(0);
  const [gstPct, setGstPct] = useState(0);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [saving, setSaving] = useState(false);

  const [eventId, setEventId] = useState('');
  // tierId -> qty, only tiers with qty > 0 are part of the order.
  const [tierQty, setTierQty] = useState<Record<string, number>>({});
  const [guest, setGuest] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('—');
  const [others, setOthers] = useState<{ name: string; gender: string; whatsapp: string }[]>([]);
  const [method, setMethod] = useState('Cash');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveEvents.list('approved'), liveSettings.get()])
      .then(([evs, s]) => {
        setApprovedEvents(evs);
        setBookingFee(s.bookingFee);
        setGstPct(s.gstEnabled ? s.gstPct : 0);
        if (!eventId && evs[0]) setEventId(evs[0].id);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const event = approvedEvents.find((e) => e.id === eventId);
  const lines = event
    ? event.tiers.map((t) => ({ tier: t, qty: tierQty[t.id] ?? 0 })).filter((l) => l.qty > 0)
    : [];
  const isComp = method === 'Comp (free)';
  const expectedHeadcount = lines.reduce((a, l) => a + l.qty * partySizeFromTierName(l.tier.name), 0);
  const totalSlots = expectedHeadcount;

  const totals = useMemo(() => {
    if (lines.length === 0 || isComp) return { subtotal: 0, fees: 0, gst: 0, total: 0 };
    const subtotal = lines.reduce((a, l) => a + l.tier.price * l.qty, 0);
    const fees = Math.round((subtotal * bookingFee) / 100);
    // Same GST-on-the-booking-fee-only rule as guest checkout — see
    // BookingsService.adminCreate's own doc comment.
    const gst = Math.round((fees * gstPct) / 100);
    return { subtotal, fees, gst, total: subtotal + fees + gst };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lines, isComp, bookingFee, gstPct]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const setQtyFor = (tierId: string, max: number, next: number) => {
    setTierQty((prev) => ({ ...prev, [tierId]: Math.max(0, Math.min(max, next)) }));
  };

  const setOther = (i: number, patch: Partial<{ name: string; gender: string; whatsapp: string }>) =>
    setOthers((prev) => {
      const next = [...prev];
      while (next.length < i + 1) next.push({ name: '', gender: '—', whatsapp: '' });
      next[i] = { ...next[i], ...patch };
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || lines.length === 0) { setErr('Pick a live event and at least one ticket tier'); return; }
    if (!guest.trim() || !phone.trim()) { setErr('Guest name and phone are required'); return; }

    const extra = others
      .slice(0, totalSlots - 1)
      .filter((o) => o.name.trim())
      .map((o) => ({ name: o.name.trim(), gender: o.gender === '—' ? undefined : o.gender, whatsapp: o.whatsapp.trim() || undefined }));

    setSaving(true);
    setErr('');
    try {
      await liveManualBooking.create({
        eventId: event.id,
        lines: lines.map((l) => ({ tierId: l.tier.id, qty: l.qty })),
        guestName: guest.trim(),
        phone: phone.trim(),
        gender: gender === '—' ? undefined : gender,
        others: extra,
        method: isComp ? 'Comp' : method,
      });
      navigate('/bookings');
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to create booking');
      setSaving(false);
    }
  };

  if (!loading && approvedEvents.length === 0) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">No live events to book against</h1>
        <Link to="/bookings" className="btn btn-ghost" style={{ width: 'fit-content' }}><ArrowLeft size={14} /> Bookings</Link>
      </div>
    );
  }

  return (
    <form className="stack fade" style={{ maxWidth: 560, gap: 12 }} onSubmit={submit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/bookings" style={{ fontSize: 13, display: 'inline-flex', alignItems: 'center', gap: 4 }}><ArrowLeft size={13} /> Bookings</Link>
        <h1 className="page-title">Manual booking</h1>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>for phone orders, walk-ups and comps — the guest gets the group QR on WhatsApp</div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field">
          <label>Event (live only)</label>
          <select
            className="input"
            value={eventId}
            onChange={(e) => { setEventId(e.target.value); setTierQty({}); }}
          >
            {approvedEvents.map((e) => (
              <option key={e.id} value={e.id}>{e.title} · {new Date(e.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</option>
            ))}
          </select>
        </div>
        {event && (
          <>
            <div className="field">
              <label>Ticket tiers — mix as many as this booking needs</label>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {event.tiers.map((t) => {
                  const rem = t.quantity - t.sold;
                  const q = tierQty[t.id] ?? 0;
                  return (
                    <div key={t.id} className="dashed-box" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, opacity: rem <= 0 ? 0.4 : 1 }}>
                      <span className="small">{t.name} · ₹{fmt(t.price)} {rem <= 0 ? '· sold out' : `· ${rem} left`}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={q <= 0} onClick={() => setQtyFor(t.id, rem, q - 1)}>−</button>
                        <b>{q}</b>
                        <button type="button" className="btn btn-ghost btn-sm" disabled={q >= rem} onClick={() => setQtyFor(t.id, rem, q + 1)}>+</button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="field">
              <label>Payment method</label>
              <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option>Cash</option>
                <option>UPI</option>
                <option>Card</option>
                <option>Comp (free)</option>
              </select>
            </div>
          </>
        )}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="display" style={{ fontWeight: 700 }}>Guest details</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <div className="field" style={{ flex: 1.4, minWidth: 140 }}>
            <label>Main guest name</label>
            <input className="input" value={guest} onChange={(e) => setGuest(e.target.value)} autoFocus />
          </div>
          <div className="field" style={{ width: 120 }}>
            <label>Gender</label>
            <select className="input" value={gender} onChange={(e) => setGender(e.target.value)}>
              <option value="—">—</option>
              <option value="F">Female</option>
              <option value="M">Male</option>
              <option value="O">Other</option>
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>WhatsApp number</label>
            <input className="input" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+91" inputMode="tel" />
          </div>
        </div>
        {totalSlots > 1 &&
          Array.from({ length: totalSlots - 1 }, (_, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', borderTop: '1px dashed rgba(139,195,74,.2)', paddingTop: 8 }}>
              <div className="field" style={{ flex: 1.4, minWidth: 140 }}>
                <label>Guest {i + 2} name</label>
                <input className="input" value={others[i]?.name ?? ''} onChange={(e) => setOther(i, { name: e.target.value })} placeholder={`Guest ${i + 2}`} />
              </div>
              <div className="field" style={{ width: 120 }}>
                <label>Gender</label>
                <select className="input" value={others[i]?.gender ?? '—'} onChange={(e) => setOther(i, { gender: e.target.value })}>
                  <option value="—">—</option>
                  <option value="F">Female</option>
                  <option value="M">Male</option>
                  <option value="O">Other</option>
                </select>
              </div>
              <div className="field" style={{ flex: 1, minWidth: 140 }}>
                <label>WhatsApp (optional)</label>
                <input className="input" value={others[i]?.whatsapp ?? ''} onChange={(e) => setOther(i, { whatsapp: e.target.value })} placeholder="+91" inputMode="tel" />
              </div>
            </div>
          ))}
        <div className="tiny hint">
          {lines.some((l) => partySizeFromTierName(l.tier.name) > 1) && 'A Couple/Group tier admits more than one person per ticket — '}
          gender is checked by gender-targeted promo codes · each guest's WhatsApp gets the group QR
        </div>
      </div>

      {lines.length > 0 && (
        <div className="dashed-box" style={{ fontSize: 12.5 }}>
          {isComp ? (
            <><b style={{ color: 'var(--text)' }}>Comp booking:</b> {lines.map((l) => `${l.qty} × ${l.tier.name}`).join(', ')} — <b className="green">free entry</b>, no charge</>
          ) : (
            <>
              {lines.map((l) => `${l.qty} × ${l.tier.name}`).join(', ')} — Subtotal ₹{fmt(totals.subtotal)} + booking fee ₹{fmt(totals.fees)}{totals.gst > 0 ? ` + GST ₹${fmt(totals.gst)}` : ''} → collect{' '}
              <b style={{ color: 'var(--text)' }}>₹{fmt(totals.total)}</b> via {method}
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }} disabled={saving || lines.length === 0}>
          {saving ? 'Saving…' : isComp ? <>Create comp booking <Check size={14} /></> : <>Record booking — ₹{fmt(totals.total)} <Check size={14} /></>}
        </button>
        <Link to="/bookings" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
