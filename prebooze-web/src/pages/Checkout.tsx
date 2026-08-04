import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, CART_HOLD_MINUTES } from '../store/AppContext';
import { eventById, fmtDate, fmtTime, venueById } from '../data/mock';
import type { Booking, Event, PayMethod } from '../types';
import { auth, bookings, catalog, wallet, type BookingQuote } from '../api';
import { isBackendEnabled } from '../api/client';
import { existingRole, roleHome, roleLabel } from '../lib/roles';
import { usePlatformInfo } from '../lib/usePlatformInfo';
import { track } from '../lib/track';
import { eventLocation } from '../lib/venue';

const ABSORBED_NOTE: Record<string, string> = {
  Organizer: 'absorbed by the organizer',
  Guest: 'paid by you',
  Split: 'split between you and the organizer',
};

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function loadRazorpayScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as { Razorpay?: unknown }).Razorpay) return resolve();
    const existing = document.getElementById('razorpay-checkout-js') as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Could not load the payment widget — check your connection')));
      return;
    }
    const script = document.createElement('script');
    script.id = 'razorpay-checkout-js';
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Could not load the payment widget — check your connection'));
    document.body.appendChild(script);
  });
}

export default function Checkout() {
  const {
    user, selection, coupons, myEvents, addBooking, setSelection, holdExpiry, startHold, setHold, clearHold,
    captureCart, setCartStatus, pendingPromoterRef, setPendingPromoterRef, walletBalance, spendWallet, payMethods,
    setDefaultPayMethod, refreshWallet,
  } = useApp();
  const navigate = useNavigate();
  const { feeLabel, absorbedBy, bookingFee, socials } = usePlatformInfo();

  const wantsLive = Boolean(selection?.eventSlug) && isBackendEnabled();

  // ---- real event (by slug — the only lookup the public catalog supports) ----
  const [liveEvent, setLiveEvent] = useState<Event | null>(null);
  useEffect(() => {
    if (!selection?.eventSlug || !isBackendEnabled()) return;
    catalog.event(selection.eventSlug).then(setLiveEvent).catch(() => {});
  }, [selection?.eventSlug]);

  const event = liveEvent ?? (selection ? (eventById(selection.eventId) ?? myEvents.find((e) => e.id === selection.eventId)) : undefined);

  // ---- real hold (Redis-backed, 8-min TTL) — only for real events, needs a logged-in guest ----
  const [holdId, setHoldId] = useState<string | null>(null);
  const [holdErr, setHoldErr] = useState<string | null>(null);
  useEffect(() => {
    if (!liveEvent || !selection || !user || holdId) return;
    bookings
      .hold(liveEvent.id, selection.qty)
      .then((h) => {
        setHoldId(h.holdId);
        setHold(new Date(h.expiresAt).getTime());
        track('checkout_viewed', { eventId: liveEvent.id });
      })
      .catch((e) => setHoldErr(e.message ?? 'Could not hold your tickets — they may have sold out'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [liveEvent, selection, user]);

  // logged-out guest landed here with a real-event selection (e.g. a stale
  // persisted selection) — send them to login first, same as EventDetail's book()
  useEffect(() => {
    if (wantsLive && !user) navigate('/login', { state: { from: '/checkout' } });
  }, [wantsLive, user, navigate]);

  // ---- real wallet balance + saved pay methods ----
  const [liveWalletBalance, setLiveWalletBalance] = useState(0);
  const [livePayMethods, setLivePayMethods] = useState<PayMethod[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled() || !user) return;
    wallet.balance().then((w) => setLiveWalletBalance(w.balance)).catch(() => {});
    wallet.payMethods().then(setLivePayMethods).catch(() => {});
  }, [user]);

  // Cart hold timer — arm on entry (mock path only; the real hold effect above
  // arms this from the server's expiresAt), tick every second, release on expiry.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  useEffect(() => {
    if (!selection || holdExpiry != null || wantsLive) return;
    startHold();
  }, [selection, holdExpiry, startHold, wantsLive]);
  const remaining = holdExpiry ? Math.max(0, holdExpiry - now) : 0;
  const expired = holdExpiry != null && holdExpiry <= now;
  const lowTime = remaining <= 60000;
  const mmss = `${String(Math.floor(remaining / 60000)).padStart(2, '0')}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}`;

  const [name, setName] = useState(user?.name ?? '');
  const [gender, setGender] = useState(user?.gender ?? '');
  const [whatsapp, setWhatsapp] = useState(user?.phone ?? '');
  const [email, setEmail] = useState(user?.email ?? '');
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [guestGenders, setGuestGenders] = useState<string[]>([]);
  const [guestPhones, setGuestPhones] = useState<string[]>([]);
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
  const fee = Math.round(ticketCount * bookingFee);

  const discount = useMemo(() => {
    if (!appliedCode) return 0;
    const c = coupons.find((x) => x.code === appliedCode);
    if (!c) return 0;
    const raw = c.type === 'percent' ? (subtotal * c.value) / 100 : c.value;
    return Math.min(Math.round(raw), c.maxDiscount ?? raw, subtotal);
  }, [appliedCode, coupons, subtotal]);

  const [useCredit, setUseCredit] = useState(true);
  const effectiveWalletBalance = liveEvent ? liveWalletBalance : walletBalance;
  const creditApplied = useCredit ? Math.min(effectiveWalletBalance, Math.max(0, subtotal + fee - discount)) : 0;
  const total = subtotal + fee - discount - creditApplied;

  // ---- real, server-priced quote — never trust the client math above for a
  // real event; it's only the pre-quote placeholder shown before this resolves. ----
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  useEffect(() => {
    if (!holdId) return;
    let cancelled = false;
    setQuoting(true);
    bookings
      .quote(holdId, appliedCode ?? undefined, useCredit ? effectiveWalletBalance : 0)
      .then((q) => {
        if (cancelled) return;
        setQuote(q);
        if (appliedCode) setCouponMsg({ ok: true, text: `${appliedCode} applied — you save ₹${q.discount}` });
      })
      .catch((e) => {
        if (cancelled) return;
        if (appliedCode) {
          setCouponMsg({ ok: false, text: e.message ?? `"${appliedCode}" isn't valid for this event` });
          setAppliedCode(null);
        }
      })
      .finally(() => {
        if (!cancelled) setQuoting(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdId, appliedCode, useCredit, effectiveWalletBalance]);

  const finalSubtotal = quote?.subtotal ?? subtotal;
  const finalFee = quote?.fee ?? fee;
  const finalDiscount = quote?.discount ?? discount;
  const finalCredit = quote?.walletCreditUsed ?? creditApplied;
  const finalTotal = quote?.total ?? total;

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

  const heldRole = existingRole(user);
  if (heldRole) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>{roleLabel(heldRole)[0].toUpperCase() + roleLabel(heldRole).slice(1)} accounts can't book tickets</h1>
          <p className="muted" style={{ margin: '10px 0 20px' }}>
            This number is registered as a {roleLabel(heldRole)} — a business account. To book tickets as a guest,
            use a personal number.
          </p>
          <Link to={roleHome[heldRole]} className="btn btn-pri">Go to my {roleLabel(heldRole)} space →</Link>
        </div>
      </main>
    );
  }

  if (wantsLive && !liveEvent && !holdErr) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Loading your checkout…</h1>
        </div>
      </main>
    );
  }

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

  if (holdErr) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '72px 0' }}>
          <div className="card card-shadow" style={{ maxWidth: 460, margin: '0 auto', textAlign: 'center' }}>
            <div className="confirm-tick" style={{ background: 'var(--danger)', color: '#fff' }}>⏱</div>
            <h1 style={{ fontSize: 22, marginTop: 8 }}>{holdErr}</h1>
            <button
              className="btn btn-pri btn-lg"
              style={{ marginTop: 8 }}
              onClick={() => {
                setSelection(null);
                navigate(`/events/${event.slug}`);
              }}
            >
              Pick tickets again →
            </button>
          </div>
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
                clearHold();
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

  const venue = event.venue ?? (event.venueId ? venueById(event.venueId) : undefined);

  const applyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) return;
    if (liveEvent) {
      // real validation happens server-side in the quote effect below
      setAppliedCode(code);
      return;
    }
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

  const afterBookingSuccess = (id: string) => {
    track('booking_completed', { eventId: event?.id });
    if (cartId) setCartStatus(cartId, 'completed');
    setSelection(null);
    clearHold();
    setPendingPromoterRef(null);
    refreshWallet(); // a live purchase may have just spent real wallet credit
    navigate('/confirmation/' + encodeURIComponent(id));
  };

  const payLive = async () => {
    if (!holdId) return;
    setPaying(true);
    try {
      // the booking confirmation email is sent to the account's profile
      // email (there's no separate per-booking email on the backend), so
      // persist whatever the guest just typed here before creating it
      if (email.trim() !== (user?.email ?? '')) {
        await auth.updateMe({ email: email.trim() }).catch(() => {});
      }
      const q = quote ?? (await bookings.quote(holdId, appliedCode ?? undefined, useCredit ? effectiveWalletBalance : 0));
      // Skipped guest slots (name left blank) aren't sent at all, rather than
      // padding the booking's guest list with empty placeholder entries.
      const guestsPayload = ticketCount > 1
        ? Array.from({ length: ticketCount - 1 }, (_, i) => ({
            name: (guestNames[i] ?? '').trim(),
            gender: guestGenders[i] || undefined,
            whatsapp: (guestPhones[i] ?? '').trim(),
          })).filter((g) => g.name)
        : undefined;

      const finishCreate = (razorpay?: { orderId: string; paymentId: string; signature: string }) =>
        bookings.create({
          holdId,
          mainGuest: name.trim(),
          whatsapp: whatsapp.trim(),
          guests: guestsPayload,
          couponCode: appliedCode ?? undefined,
          walletCredit: useCredit ? effectiveWalletBalance : 0,
          promoterRef: pendingPromoterRef ?? undefined,
          payMethodId: (livePayMethods ?? []).some((m) => m.id === payMethod) ? payMethod : undefined,
          razorpay,
        });

      if (q.total > 0 && q.razorpayOrderId && q.razorpayKeyId) {
        await loadRazorpayScript();
        const Razorpay = (window as unknown as { Razorpay: new (opts: Record<string, unknown>) => { open: () => void; on: (evt: string, cb: (e: unknown) => void) => void } }).Razorpay;
        const rzp = new Razorpay({
          key: q.razorpayKeyId,
          order_id: q.razorpayOrderId,
          amount: q.total * 100,
          currency: 'INR',
          name: 'Prebooze',
          description: event.title,
          prefill: { name: name.trim(), contact: whatsapp.trim(), email: email.trim() || undefined },
          theme: { color: '#9be13d' },
          handler: async (resp: unknown) => {
            track('payment_submitted', { eventId: event.id });
            const r = resp as { razorpay_order_id: string; razorpay_payment_id: string; razorpay_signature: string };
            try {
              const booking = await finishCreate({ orderId: r.razorpay_order_id, paymentId: r.razorpay_payment_id, signature: r.razorpay_signature });
              afterBookingSuccess(booking.id);
            } catch (e) {
              setPaying(false);
              setCouponMsg({ ok: false, text: (e as Error).message ?? 'Payment succeeded but the booking could not be finalized — contact support' });
            }
          },
          modal: { ondismiss: () => setPaying(false) },
        });
        rzp.on('payment.failed', () => {
          setPaying(false);
          setCouponMsg({ ok: false, text: 'Payment failed or was cancelled' });
        });
        track('payment_widget_opened', { eventId: event.id });
        rzp.open();
      } else {
        const booking = await finishCreate(undefined);
        afterBookingSuccess(booking.id);
      }
    } catch (e) {
      setPaying(false);
      setCouponMsg({ ok: false, text: (e as Error).message ?? 'Something went wrong — please try again' });
    }
  };

  const payMock = () => {
    setPaying(true);
    setTimeout(() => {
      const id = '#TKT-' + Math.floor(10000 + Math.random() * 89999);
      const guests = [
        { name: name.trim(), checkedIn: false, gender: gender || undefined, whatsapp: whatsapp.trim() },
        ...Array.from({ length: ticketCount - 1 }, (_, i) => ({
          name: (guestNames[i] ?? '').trim(),
          checkedIn: false,
          gender: guestGenders[i] || undefined,
          whatsapp: (guestPhones[i] ?? '').trim(),
        })).filter((g) => g.name),
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
      if (payMethods.some((m) => m.id === payMethod)) setDefaultPayMethod(payMethod);
      if (creditApplied > 0) spendWallet(creditApplied, `Paid at checkout — ${id}`);
      afterBookingSuccess(id);
    }, 900);
  };

  const pay = () => {
    if (!name.trim() || !whatsapp.trim()) {
      setCouponMsg({ ok: false, text: 'Main attendee name and WhatsApp number are required' });
      return;
    }
    // Guest names/numbers are optional — check-in scans one QR for the whole
    // booking (BookingsService.checkIn toggles a single Booking.checkedIn
    // flag, not per-guest), and the backend already accepts a partial or
    // empty guest list, so blocking payment on this info was pure friction
    // with no corresponding security benefit. Whatever's filled in still
    // gets saved for the organizer's guest list.
    if (!EMAIL_RE.test(email.trim())) {
      setCouponMsg({ ok: false, text: 'Enter a valid email — your ticket confirmation is sent there too' });
      return;
    }
    if (liveEvent) payLive();
    else payMock();
  };

  const displayPayMethods = liveEvent ? (livePayMethods ?? []) : payMethods;

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
                <>
                  <div className="small muted" style={{ marginBottom: 12 }}>
                    Optional — add your friends' names now if you have them handy, or skip and bring them along. You'll show one QR for the whole group at the door.
                  </div>
                  {Array.from({ length: ticketCount - 1 }, (_, i) => (
                    <div key={i} className="form-row">
                      <div className="field">
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
                          placeholder={`Guest ${i + 2} full name`}
                        />
                      </div>
                      <div className="field">
                        <span>Gender</span>
                        <select
                          value={guestGenders[i] ?? ''}
                          onChange={(e) =>
                            setGuestGenders((g) => {
                              const next = [...g];
                              next[i] = e.target.value;
                              return next;
                            })
                          }
                        >
                          <option value="">Select…</option>
                          <option>Female</option>
                          <option>Male</option>
                          <option>Non-binary</option>
                          <option>Prefer not to say</option>
                        </select>
                      </div>
                      <div className="field">
                        <span>WhatsApp number</span>
                        <input
                          value={guestPhones[i] ?? ''}
                          inputMode="numeric"
                          onChange={(e) =>
                            setGuestPhones((g) => {
                              const next = [...g];
                              next[i] = e.target.value.replace(/[^\d+ ]/g, '').slice(0, 14);
                              return next;
                            })
                          }
                          placeholder="+91"
                        />
                      </div>
                    </div>
                  ))}
                </>
              )}
              <div className="field">
                <span>Email</span>
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.com" />
              </div>
              <div className="small muted">
                🎟 Tickets sent to WhatsApp <span className="bold">{whatsapp || '—'}</span> and emailed to{' '}
                <span className="bold">{email || '—'}</span> <span className="verified">✓</span>
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
                <button className="btn btn-ghost" style={{ flex: '0 0 auto' }} onClick={applyCoupon} disabled={quoting}>
                  Apply
                </button>
              </div>
              {couponMsg && (
                <div className={`small ${couponMsg.ok ? 'accent' : 'danger-text'}`} style={{ marginTop: 10 }}>
                  {couponMsg.ok ? '✓ ' : '✕ '}
                  {couponMsg.text}
                </div>
              )}
              {!liveEvent && (
                <div className="tiny muted-2" style={{ marginTop: 8 }}>
                  Try FIRST50 — 50% off up to ₹100 for first-time users
                </div>
              )}
            </div>

            {/* Payment */}
            <div className="card">
              <h3 style={{ marginBottom: 14 }}>Pay with</h3>
              {[
                ...displayPayMethods.map((m) => ({ id: m.id, label: `${m.type === 'upi' ? '🅿️' : '💳'} ${m.label}${m.isDefault ? ' · default' : ''} (saved)` })),
                { id: 'razorpay', label: 'Razorpay — UPI / cards / netbanking' },
                ...(liveEvent ? [] : [{ id: 'card', label: 'Card •••• 4242' }, { id: 'wallet', label: 'Apple / Google Pay' }]),
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
              {fmtDate(event.date)} · {fmtTime(event.date)} · {eventLocation(event, venue)}
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
              <span className="k">{feeLabel} <span className="muted" style={{ fontSize: 11 }}>({ABSORBED_NOTE[absorbedBy] ?? ABSORBED_NOTE.Guest})</span></span>
              <span>₹{finalFee}</span>
            </div>
            {finalDiscount > 0 && (
              <div className="kv">
                <span className="k accent">Coupon {appliedCode}</span>
                <span className="accent">−₹{finalDiscount}</span>
              </div>
            )}
            {effectiveWalletBalance > 0 && (
              <label className="checkbox-row" style={{ margin: '8px 0 2px', fontSize: 13 }}>
                <input type="checkbox" checked={useCredit} onChange={(e) => setUseCredit(e.target.checked)} />
                👛 Use ₹{Math.min(effectiveWalletBalance, Math.max(0, finalSubtotal + finalFee - finalDiscount))} Prebooze credit (balance ₹{effectiveWalletBalance})
              </label>
            )}
            {finalCredit > 0 && (
              <div className="kv">
                <span className="k accent">Wallet credit</span>
                <span className="accent">−₹{finalCredit}</span>
              </div>
            )}
            <div className="total-row">
              <span>Total</span>
              <span>₹{finalTotal}</span>
            </div>
            <button className="btn btn-pri btn-block btn-lg" onClick={pay} disabled={paying || (liveEvent ? !holdId : false) || quoting}>
              {paying ? 'Processing…' : `Pay ₹${finalTotal}`}
            </button>
            <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
              🔒 secured by Razorpay · <Link to="/legal/refund-policy" className="link">cancel any time before the event</Link>
            </div>
            {socials.whatsapp && (
              <div className="tiny muted-2 center" style={{ marginTop: 4 }}>
                Need help? <a href={/^https?:\/\//i.test(socials.whatsapp.trim()) ? socials.whatsapp.trim() : `https://${socials.whatsapp.trim()}`} target="_blank" rel="noopener noreferrer" className="link">WhatsApp us</a>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
