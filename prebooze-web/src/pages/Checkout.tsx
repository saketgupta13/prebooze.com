import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, CART_HOLD_MINUTES } from '../store/AppContext';
import { eventById, fmtDate, fmtTime, venueById } from '../data/mock';
import type { Booking } from '../types';

const BOOKING_FEE_PER_TICKET = 1.5;

export default function Checkout() {
  const { user, selection, coupons, myEvents, addBooking, setSelection, holdExpiry, startHold, captureCart, setCartStatus, pendingPromoterRef, setPendingPromoterRef, walletBalance, spendWallet, payMethods, setDefaultPayMethod } = useApp();
  const navigate = useNavigate();

  const event = selection
    ? (eventById(selection.eventId) ?? myEvents.find((e) => e.id === selection.eventId))
    : undefined;

  // Cart hold timer — arm on entry, tick every second, release (hard) on expiry.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (selection && holdExpiry == null) startHold();
  }, [selection, holdExpiry, startHold]);
  const remaining = holdExpiry ? Math.max(0, holdExpiry - now) : 0;
  const expired = holdExpiry != null && holdExpiry <= now;
  const lowTime = remaining <= 60000;
  const mmss = `${String(Math.floor(remaining / 60000)).padStart(2, '0')}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}`;

  const [name, setName] = useState(user?.name ?? '');
  const [gender, setGender] = useState(user?.gender ?? '');
  const [whatsapp, setWhatsapp] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [allGuests, setAllGuests] = useState(false);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [payMethod, setPayMethod] = useState(() => payMethods.find((m) => m.isDefault)?.id ?? 'razorpay');
  const [paying, setPaying] = useState(false);

  const lines = useMemo(() => {
    if (!event || !selection) return [];
    return event.tiers
      .filter((t) => (selection.qty[t.id] ?? 0) > 0)
      .map((t) => ({ tier: t, qty: selection.qty[t.id] }));
  }, [event, selection]);

  const ticketCount = lines.reduce((a, l) => a + l.qty, 0);
  const subtotal = lines.reduce((a, l) => a + l.qty * l.tier.price, 0);
  const fee = Math.round(ticketCount * BOOKING_FEE_PER_TICKET);

  const discount = useMemo(() => {
    if (!appliedCode) return 0;
    const c = coupons.find((x) => x.code === appliedCode);
    if (!c) return 0;
    const raw = c.type === 'percent' ? (subtotal * c.value) / 100 : c.value;
    return Math.min(Math.round(raw), c.maxDiscount ?? raw, subtotal);
  }, [appliedCode, coupons, subtotal]);

  const [useCredit, setUseCredit] = useState(true);
  const creditApplied = useCredit ? Math.min(walletBalance, Math.max(0, subtotal + fee - discount)) : 0;
  const total = subtotal + fee - discount - creditApplied;

  const cartId = user && selection ? `${user.phone}::${selection.eventId}` : null;

  // Capture the cart on checkout entry (abandoned-cart recovery) — we already have
  // the guest's name + WhatsApp from login.
  useEffect(() => {
    if (!user || !event || !selection || lines.length === 0 || expired) return;
    captureCart({
      id: `${user.phone}::${event.id}`,
      userPhone: user.phone,
      userName: user.name || 'Guest',
      eventId: event.id,
      eventTitle: event.title,
      qty: ticketCount,
      qtyMap: selection.qty,
      tierSummary: lines.map((l) => `${l.qty}× ${l.tier.name}`).join(', '),
      subtotal,
      total,
      createdAt: new Date().toISOString(),
    });
    // capture once per checkout entry; qty/price come from the (stable) selection
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, event, selection]);

  // Hold lapsed without payment → mark the cart abandoned (recoverable).
  useEffect(() => {
    if (expired && cartId) setCartStatus(cartId, 'abandoned');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expired]);

  if (!event || !selection || lines.length === 0) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Nothing to check out</h1>
          <p className="muted" style={{ margin: '10px 0 20px' }}>
            Pick an event and select tickets first.
          </p>
          <Link to="/browse" className="btn btn-pri">
            Browse events
          </Link>
        </div>
      </main>
    );
  }

  if (expired) {
    const slug = event.slug;
    return (
      <main className="page">
        <div className="container center" style={{ padding: '72px 0' }}>
          <div className="card card-shadow" style={{ maxWidth: 460, margin: '0 auto', textAlign: 'center' }}>
            <div className="confirm-tick" style={{ background: 'var(--danger)', color: '#fff' }}>⏱</div>
            <h1 style={{ fontSize: 22, marginTop: 8 }}>Your hold expired</h1>
            <p className="muted" style={{ margin: '10px 0 18px' }}>
              We held your {ticketCount} ticket{ticketCount > 1 ? 's' : ''} for {CART_HOLD_MINUTES} minutes. Pick them
              again to continue — popular tiers can sell out fast.
            </p>
            <button
              className="btn btn-pri btn-lg"
              onClick={() => {
                setSelection(null);
                navigate(`/events/${slug}`);
              }}
            >
              Pick tickets again →
            </button>
          </div>
        </div>
      </main>
    );
  }

  const venue = venueById(event.venueId);

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    const c = coupons.find((x) => x.code === code);
    if (!c) return setCouponMsg({ ok: false, text: `“${code}” isn't a valid code` });
    if (c.status !== 'active') return setCouponMsg({ ok: false, text: `${code} is paused right now` });
    if (c.eventScope !== 'all' && c.eventScope !== event.title)
      return setCouponMsg({ ok: false, text: `${code} isn't valid for this event` });
    setAppliedCode(code);
    const raw = c.type === 'percent' ? (subtotal * c.value) / 100 : c.value;
    const save = Math.min(Math.round(raw), c.maxDiscount ?? raw, subtotal);
    setCouponMsg({ ok: true, text: `${code} applied — you save ₹${save}` });
  };

  const pay = () => {
    if (!name.trim() || !whatsapp.trim()) {
      setCouponMsg({ ok: false, text: 'Main attendee name and WhatsApp number are required' });
      return;
    }
    setPaying(true);
    // Razorpay integration point — mocked for now
    setTimeout(() => {
      const id = '#TKT-' + Math.floor(10000 + Math.random() * 89999);
      const guests = [
        { name: name.trim(), checkedIn: false },
        ...Array.from({ length: ticketCount - 1 }, (_, i) => ({
          name: (allGuests && guestNames[i]?.trim()) || `Guest ${i + 2}`,
          checkedIn: false,
        })),
      ];
      const booking: Booking = {
        id,
        eventId: event.id,
        tierId: lines[0].tier.id,
        tierName: lines.map((l) => `${l.qty}× ${l.tier.name}`).join(', '),
        qty: ticketCount,
        subtotal,
        fee,
        discount,
        total,
        couponCode: appliedCode ?? undefined,
        status: 'confirmed',
        guests,
        mainGuest: name.trim(),
        whatsapp: whatsapp.trim(),
        createdAt: new Date().toISOString(),
        promoterRef: pendingPromoterRef ?? undefined,
      };
      addBooking(booking);
      // remember the method used as the preferred (default) one
      if (payMethods.some((m) => m.id === payMethod)) setDefaultPayMethod(payMethod);
      if (creditApplied > 0) spendWallet(creditApplied, `Paid at checkout — ${id}`);
      if (cartId) setCartStatus(cartId, 'completed');
      setSelection(null);
      setPendingPromoterRef(null);
      navigate('/confirmation/' + encodeURIComponent(id));
    }, 900);
  };

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to={`/events/${event.slug}`}>← {event.title}</Link> / Checkout · step 2 of 2 ·{' '}
          <span className="accent">🔒 secure checkout</span>
        </div>
        <h1 style={{ fontSize: 24, marginBottom: 16 }}>Checkout</h1>

        {holdExpiry && !expired && (
          <div
            className="card"
            style={{
              marginBottom: 16,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '12px 16px',
              borderColor: lowTime ? 'var(--danger)' : 'var(--accent)',
              background: lowTime ? 'rgba(255,90,90,.06)' : 'rgba(155,225,61,.06)',
            }}
          >
            <span style={{ fontSize: 20 }}>⏳</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="small bold">
                {ticketCount} ticket{ticketCount > 1 ? 's' : ''} held for you
              </div>
              <div className="tiny muted-2">
                {lowTime ? 'Hurry — your hold is about to expire.' : 'Complete payment before the hold runs out.'}
              </div>
            </div>
            <div
              className={lowTime ? 'danger-text' : 'accent'}
              style={{ fontSize: 22, fontWeight: 800, fontVariantNumeric: 'tabular-nums' }}
            >
              {mmss}
            </div>
          </div>
        )}

        <div className="checkout-grid">
          <div>
            {/* Attendee details */}
            <div className="card" style={{ marginBottom: 18 }}>
              <h3 style={{ marginBottom: 14 }}>Attendee details</h3>
              <div className="field">
                <span>Full name (main attendee)</span>
                <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
              </div>
              <div className="form-row">
                <div className="field">
                  <span>Gender</span>
                  <select value={gender} onChange={(e) => setGender(e.target.value)}>
                    <option value="">Select…</option>
                    <option>Female</option>
                    <option>Male</option>
                    <option>Non-binary</option>
                    <option>Prefer not to say</option>
                  </select>
                </div>
                <div className="field">
                  <span>WhatsApp number</span>
                  <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+91" />
                </div>
              </div>
              {ticketCount > 1 && (
                <label className="checkbox-row" style={{ marginBottom: 12 }}>
                  <input
                    type="checkbox"
                    checked={allGuests}
                    onChange={(e) => setAllGuests(e.target.checked)}
                  />
                  Add name & number for all {ticketCount} attendees
                </label>
              )}
              {allGuests &&
                Array.from({ length: ticketCount - 1 }, (_, i) => (
                  <div key={i} className="field">
                    <span>Guest {i + 2} name</span>
                    <input
                      value={guestNames[i] ?? ''}
                      onChange={(e) =>
                        setGuestNames((g) => {
                          const next = [...g];
                          next[i] = e.target.value;
                          return next;
                        })
                      }
                      placeholder={`Guest ${i + 2}`}
                    />
                  </div>
                ))}
              <div className="field">
                <span>Email (optional)</span>
                <input value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.com" />
              </div>
              <div className="small muted">
                🎟 Tickets sent to WhatsApp <span className="bold">{whatsapp || '—'}</span>{' '}
                <span className="verified">✓</span>
              </div>
            </div>

            {/* Coupon */}
            <div className="card" style={{ marginBottom: 18 }}>
              <h3 style={{ marginBottom: 14 }}>Apply coupon</h3>
              <div className="form-row">
                <input
                  placeholder="Coupon code"
                  value={couponInput}
                  onChange={(e) => setCouponInput(e.target.value)}
                />
                <button className="btn btn-ghost" style={{ flex: '0 0 auto' }} onClick={applyCoupon}>
                  Apply
                </button>
              </div>
              {couponMsg && (
                <div className={`small ${couponMsg.ok ? 'accent' : 'danger-text'}`} style={{ marginTop: 10 }}>
                  {couponMsg.ok ? '✓ ' : '✕ '}
                  {couponMsg.text}
                </div>
              )}
              <div className="tiny muted-2" style={{ marginTop: 8 }}>
                Try FIRST50 — 50% off up to ₹100 for first-time users
              </div>
            </div>

            {/* Payment */}
            <div className="card">
              <h3 style={{ marginBottom: 14 }}>Pay with</h3>
              {[
                ...payMethods.map((m) => ({ id: m.id, label: `${m.type === 'upi' ? '🅿️' : '💳'} ${m.label}${m.isDefault ? ' · default' : ''} (saved)` })),
                { id: 'razorpay', label: 'Razorpay — UPI / cards / netbanking' },
                { id: 'card', label: 'Card •••• 4242' },
                { id: 'wallet', label: 'Apple / Google Pay' },
              ].map((m) => (
                <label key={m.id} className={`payopt ${payMethod === m.id ? 'on' : ''}`}>
                  <input
                    type="radio"
                    name="pay"
                    checked={payMethod === m.id}
                    onChange={() => setPayMethod(m.id)}
                  />
                  {m.label}
                </label>
              ))}
            </div>
          </div>

          {/* Order summary */}
          <aside className="card card-shadow ticket-box">
            <h3>{event.title}</h3>
            <div className="small muted" style={{ marginBottom: 10 }}>
              {fmtDate(event.date)} · {fmtTime(event.date)} · {venue.name}
            </div>
            {lines.map((l) => (
              <div key={l.tier.id} className="kv">
                <span className="k">
                  {l.qty} × {l.tier.name}
                </span>
                <span>₹{l.qty * l.tier.price}</span>
              </div>
            ))}
            <div className="kv">
              <span className="k">Booking fee</span>
              <span>₹{fee}</span>
            </div>
            {discount > 0 && (
              <div className="kv">
                <span className="k accent">Coupon {appliedCode}</span>
                <span className="accent">−₹{discount}</span>
              </div>
            )}
            {walletBalance > 0 && (
              <label className="checkbox-row" style={{ margin: '8px 0 2px', fontSize: 13 }}>
                <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
                👛 Use ₹{Math.min(walletBalance, Math.max(0, subtotal + fee - discount))} Prebooze credit (balance ₹{walletBalance})
              </label>
            )}
            {creditApplied > 0 && (
              <div className="kv">
                <span className="k accent">Wallet credit</span>
                <span className="accent">−₹{creditApplied}</span>
              </div>
            )}
            <div className="total-row">
              <span>Total</span>
              <span>₹{total}</span>
            </div>
            <button className="btn btn-pri btn-block btn-lg" onClick={pay} disabled={paying}>
              {paying ? 'Processing…' : `Pay ₹${total}`}
            </button>
            <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
              🔒 secured by Razorpay · free cancellation up to 48h
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
