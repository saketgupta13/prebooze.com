import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';

/** Manual booking — phone orders, walk-ups and comps recorded by the team. */
export default function ManualBooking() {
  const { events, settings, addBooking, updateEvent, toast } = useAdmin();
  const navigate = useNavigate();

  const liveEvents = events.filter((e) => e.status === 'live');
  const firstAvailableTier = (evId: string) => {
    const ev = liveEvents.find((e) => e.id === evId);
    const idx = ev?.tiers.findIndex((t) => t.qty - t.sold > 0) ?? 0;
    return idx < 0 ? 0 : idx;
  };
  const [eventId, setEventId] = useState(liveEvents[0]?.id ?? '');
  const event = liveEvents.find((e) => e.id === eventId);
  const [tierIdx, setTierIdx] = useState(() => firstAvailableTier(liveEvents[0]?.id ?? ''));
  const [qty, setQty] = useState(1);
  const [guest, setGuest] = useState('');
  const [phone, setPhone] = useState('');
  const [gender, setGender] = useState('—');
  const [others, setOthers] = useState<{ name: string; gender: string; whatsapp: string }[]>([]);
  const [method, setMethod] = useState('Cash');

  const setOther = (i: number, patch: Partial<{ name: string; gender: string; whatsapp: string }>) =>
    setOthers((prev) => {
      const next = [...prev];
      while (next.length < i + 1) next.push({ name: '', gender: '—', whatsapp: '' });
      next[i] = { ...next[i], ...patch };
      return next;
    });

  const tier = event?.tiers[Math.min(tierIdx, (event?.tiers.length ?? 1) - 1)];
  const left = tier ? tier.qty - tier.sold : 0;
  const isComp = method === 'Comp (free)';

  const totals = useMemo(() => {
    if (!tier || isComp) return { subtotal: 0, fees: 0, total: 0 };
    const subtotal = tier.price * qty;
    const fees = settings.bookingFee * qty + Math.round(settings.bookingFee * qty * (settings.gstPct / 100));
    return { subtotal, fees, total: subtotal + fees };
  }, [tier, qty, isComp, settings]);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!event || !tier) {
      toast('Pick a live event first');
      return;
    }
    if (!guest.trim() || !phone.trim()) {
      toast('Guest name and phone are required');
      return;
    }
    if (qty > left) {
      toast(`Only ${left} tickets left in ${tier.name}`);
      return;
    }
    const extra = others
      .slice(0, qty - 1)
      .filter((o) => o.name.trim())
      .map((o) => ({
        name: `${o.name.trim()}${o.gender !== '—' ? ` (${o.gender})` : ''}`,
        phone: o.whatsapp.trim() || undefined,
      }));
    addBooking({
      id: '#' + Math.floor(8500 + Math.random() * 999),
      guest: guest.trim(),
      phone: phone.trim(),
      eventId: event.id,
      qty,
      amount: totals.total,
      status: isComp ? 'checked_in' : 'paid',
      method: isComp ? 'Comp' : method + ' (manual)',
      guests: [
        { name: `${guest.trim()}${gender !== '—' ? ` (${gender})` : ''}`, phone: phone.trim(), verified: true },
        ...extra,
      ],
    });
    updateEvent(event.id, {
      sold: event.sold + qty,
      revenue: event.revenue + totals.subtotal,
      tiers: event.tiers.map((t, i) => (i === tierIdx ? { ...t, sold: t.sold + qty } : t)),
    });
    navigate('/bookings');
  };

  return (
    <form className="stack fade" style={{ maxWidth: 560, gap: 12 }} onSubmit={submit}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/bookings" style={{ fontSize: 13 }}>← Bookings</Link>
        <h1 className="page-title">Manual booking</h1>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>for phone orders, walk-ups and comps — the guest gets the group QR on WhatsApp</div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div className="field">
          <label>Event (live only)</label>
          <select
            className="input"
            value={eventId}
            onChange={(e) => {
              setEventId(e.target.value);
              setTierIdx(firstAvailableTier(e.target.value));
              setQty(1);
            }}
          >
            {liveEvents.map((e) => (
              <option key={e.id} value={e.id}>{e.title} · {e.date}</option>
            ))}
          </select>
        </div>
        {event && (
          <>
            <div className="field">
              <label>Ticket tier</label>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {event.tiers.map((t, i) => {
                  const rem = t.qty - t.sold;
                  return (
                    <button
                      key={t.name}
                      type="button"
                      className={`chip ${tierIdx === i ? 'on' : ''}`}
                      disabled={rem <= 0}
                      style={rem <= 0 ? { opacity: 0.4 } : undefined}
                      onClick={() => setTierIdx(i)}
                    >
                      {t.name} · ₹{fmt(t.price)} {rem <= 0 ? '· sold out' : `· ${rem} left`}
                    </button>
                  );
                })}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
              <div className="field" style={{ width: 120 }}>
                <label>Quantity</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQty((q) => Math.max(1, q - 1))}>−</button>
                  <b>{qty}</b>
                  <button type="button" className="btn btn-ghost btn-sm" onClick={() => setQty((q) => Math.min(10, left, q + 1))}>+</button>
                </div>
              </div>
              <div className="field" style={{ flex: 1 }}>
                <label>Payment method</label>
                <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
                  <option>Cash</option>
                  <option>UPI</option>
                  <option>Card</option>
                  <option>Comp (free)</option>
                </select>
              </div>
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
        {qty > 1 &&
          Array.from({ length: qty - 1 }, (_, i) => (
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
        <div className="tiny hint">gender is checked by gender-targeted promo codes · each guest's WhatsApp gets the group QR</div>
      </div>

      {tier && (
        <div className="dashed-box" style={{ fontSize: 12.5 }}>
          {isComp ? (
            <><b style={{ color: 'var(--text)' }}>Comp booking:</b> {qty} × {tier.name} — <b className="green">free entry</b>, marked checked-in ready</>
          ) : (
            <>
              Subtotal ₹{fmt(totals.subtotal)} + fees &amp; GST ₹{fmt(totals.fees)} → collect{' '}
              <b style={{ color: 'var(--text)' }}>₹{fmt(totals.total)}</b> via {method}
            </>
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>
          {isComp ? 'Create comp booking ✓' : `Record booking — ₹${fmt(totals.total)} ✓`}
        </button>
        <Link to="/bookings" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
