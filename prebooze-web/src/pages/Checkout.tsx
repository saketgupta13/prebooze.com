import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp, CART_HOLD_MINUTES } from '../store/AppContext';
import { eventById, fmtDate, fmtTime, venueById } from '../data/mock';
import type { Booking, Event, PayMethod } from '../types';
import { auth, bookings, catalog, wallet, type AvailableCoupon, type BookingQuote } from '../api';
import { isBackendEnabled } from '../api/client';
import { existingRole, roleHome, roleLabel } from '../lib/roles';
import { usePlatformInfo } from '../lib/usePlatformInfo';
import { track } from '../lib/track';
import { pushEvent } from '../lib/gtm';
import { trackMeta } from '../lib/meta';
import { eventLocation } from '../lib/venue';
import { cityBrowse, eventCity, eventPath } from '../lib/urls';
import { formatPrice } from '../lib/formatPrice';

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
    captureCart, setCartStatus, promoterRefByEvent, clearPromoterRefForEvent, promoterViaByEvent, walletBalance, spendWallet, payMethods,
    setDefaultPayMethod, refreshWallet, city,
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

  // ---- available promo codes for this event — event-specific organizer
  // codes plus platform-wide ones (Coupon.organizerId null), same
  // eligibility rules the real apply already enforces (BookingsService.
  // availableCoupons mirrors priceHold's checks), just surfaced up front
  // instead of only discovered after typing a code that gets rejected.
  const [availCoupons, setAvailCoupons] = useState<AvailableCoupon[]>([]);
  useEffect(() => {
    if (!event) return;
    if (liveEvent) {
      bookings.availableCoupons(event.id).then(setAvailCoupons).catch(() => setAvailCoupons([]));
    } else {
      const now = new Date();
      setAvailCoupons(
        coupons
          .filter((c) => c.status === 'active' && new Date(c.validTill) > now && c.used < c.usageLimit)
          .filter((c) => c.eventScope === 'all' || c.eventScope === event.title)
          .map((c) => ({ code: c.code, type: c.type, value: c.value, maxDiscount: c.maxDiscount ?? null, description: c.description ?? null }))
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id, liveEvent]);

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
  const [avatarUrl, setAvatarUrl] = useState(user?.avatarUrl ?? '');
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [avatarErr, setAvatarErr] = useState('');
  const avatarInputRef = useRef<HTMLInputElement>(null);
  // `user` from context often isn't ready yet at mount (it's filled in by a
  // separate auth.me() fetch, or updates later if the guest edits their
  // profile then comes back to a still-open checkout tab) — the useState
  // initializers above only ever run once, so these fields silently stayed
  // blank/stale instead of picking up the real profile once it loads.
  useEffect(() => {
    if (!user) return;
    setName(user.name ?? '');
    setGender(user.gender ?? '');
    setWhatsapp(user.phone ?? '');
    setEmail(user.email ?? '');
    setAvatarUrl(user.avatarUrl ?? '');
  }, [user?.name, user?.gender, user?.phone, user?.email, user?.avatarUrl]);
  // Optional — just for a friendlier "who's booking" summary below. Reuses
  // the same upload endpoint + persistence Edit Profile uses, so a photo
  // added here shows up on the real profile too, not just this checkout.
  const uploadAvatar = async (file: File) => {
    setAvatarErr('');
    setAvatarBusy(true);
    try {
      const { url } = await auth.upload(file);
      setAvatarUrl(url);
      await auth.updateMe({ avatarUrl: url }).catch(() => {});
    } catch {
      setAvatarErr('Upload failed — try again');
    } finally {
      setAvatarBusy(false);
    }
  };
  // A first real booking backfills User.name from whatever was typed here
  // (see BookingsService.create) — so a non-empty profile name means this
  // guest has already been through checkout before and we already have
  // their details, no need to ask again for the main attendee.
  const knownGuest = Boolean(user?.name?.trim() && user?.phone?.trim() && user?.gender);
  const [editMain, setEditMain] = useState(false);
  const showMainFields = !knownGuest || editMain;
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [guestGenders, setGuestGenders] = useState<string[]>([]);
  const [guestPhones, setGuestPhones] = useState<string[]>([]);
  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  // Separate from couponMsg — pay() used to shove attendee-field validation
  // errors into the coupon box's message slot, so a blank Email (the only
  // one of the three required fields with no visible required-indicator)
  // silently blocked payment with an error that appeared nowhere near the
  // field or the Pay button.
  const [attendeeErr, setAttendeeErr] = useState('');
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
      .quote(holdId, appliedCode ?? undefined, useCredit ? effectiveWalletBalance : 0, event?.id ? promoterRefByEvent[event.id] : undefined)
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
  }, [holdId, appliedCode, useCredit, effectiveWalletBalance, event?.id, promoterRefByEvent]);

  const finalSubtotal = quote?.subtotal ?? subtotal;
  const finalFee = quote?.fee ?? fee;
  const finalDiscount = quote?.discount ?? discount;
  const finalCredit = quote?.walletCreditUsed ?? creditApplied;
  const finalTotal = quote?.total ?? total;
  // The Pay button is already safely disabled until the real quote lands
  // (see `quoting`/`!holdId` below), but the Total *number* itself rendered
  // the client-side pre-quote estimate as if final the whole time — a real
  // guest could watch it change (promoter markup/wallet rounding/server fee
  // differ from the local estimate) right before paying. Real event only;
  // offline/mock mode has no server quote to wait for.
  const quotePending = !!liveEvent && !quote;
  const promoterMarkupApplies = quote?.promoterMarkupApplies ?? false;
  const promoterShare = quote?.promoterShare ?? 0;
  const platformShare = quote?.platformShare ?? 0;

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

  // Client-only, same reasoning as EventDetail's ViewContent — no backend
  // moment to mirror server-side. Fires once per checkout entry, same gate
  // as the cart-capture effect above.
  useEffect(() => {
    if (!user || !event || !selection || lines.length === 0 || expired) return;
    trackMeta('InitiateCheckout', {
      content_type: 'product',
      content_ids: lines.map((l) => l.tier.id),
      value: total,
      currency: 'INR',
      num_items: ticketCount,
    });
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
          <Link to={cityBrowse(city)} className="btn btn-pri">
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
                navigate(eventPath(eventCity(event) ?? city, event.slug));
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
                navigate(eventPath(eventCity(event) ?? city, slug));
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

  const clearCoupon = () => {
    setAppliedCode(null);
    setCouponInput('');
    setCouponMsg(null);
  };

  const applyCoupon = (codeOverride?: string) => {
    const code = (codeOverride ?? couponInput).trim().toUpperCase();
    if (!code) return;
    setCouponInput(code);
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
    track('booking_completed', { eventId: event?.id, meta: { bookingId: id } });
    // GA4's standard "purchase" event — using its recommended param shape
    // (transaction_id/value/currency/items) instead of a custom event name
    // is what unlocks GA4's built-in Ecommerce reports for this instead of
    // needing a hand-built one.
    pushEvent('purchase', {
      transaction_id: id,
      value: finalTotal,
      currency: 'INR',
      items: lines.map((l) => ({
        item_id: l.tier.id,
        item_name: event ? `${event.title} — ${l.tier.name}` : l.tier.name,
        price: l.tier.price,
        quantity: l.qty,
      })),
    });
    trackMeta(
      'Purchase',
      {
        value: finalTotal,
        currency: 'INR',
        content_type: 'product',
        content_ids: lines.map((l) => l.tier.id),
        num_items: lines.reduce((sum, l) => sum + l.qty, 0),
      },
      id,
    );
    if (cartId) setCartStatus(cartId, 'completed');
    setSelection(null);
    clearHold();
    if (event?.id) clearPromoterRefForEvent(event.id);
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
          promoterRef: event?.id ? promoterRefByEvent[event.id] : undefined,
          promoterVia: event?.id ? promoterViaByEvent[event.id] : undefined,
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
          modal: {
            ondismiss: () => {
              setPaying(false);
              track('payment_failed', { eventId: event.id, meta: { reason: 'user_cancelled' } });
            },
          },
        });
        rzp.on('payment.failed', (e: unknown) => {
          setPaying(false);
          setCouponMsg({ ok: false, text: 'Payment failed or was cancelled' });
          const err = (e as { error?: { reason?: string; description?: string } })?.error;
          track('payment_failed', { eventId: event.id, meta: { reason: err?.reason ?? err?.description ?? 'unknown' } });
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
        promoterRef: event?.id ? promoterRefByEvent[event.id] : undefined,
      };
      addBooking(booking);
      if (payMethods.some((m) => m.id === payMethod)) setDefaultPayMethod(payMethod);
      if (creditApplied > 0) spendWallet(creditApplied, `Paid at checkout — ${id}`);
      afterBookingSuccess(id);
    }, 900);
  };

  // The Pay button sits well below the Attendee details card on a real
  // checkout page — setting attendeeErr alone left the message correctly
  // placed but still off-screen above whatever was in view when Pay was
  // clicked, which is no better than the old disconnected-error bug in
  // practice. Scrolling the card into view is what actually makes it visible.
  const failAttendee = (msg: string) => {
    setAttendeeErr(msg);
    document.getElementById('attendee-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const pay = () => {
    setAttendeeErr('');
    if (!name.trim() || !whatsapp.trim()) {
      failAttendee('Main attendee name and WhatsApp number are required');
      return;
    }
    if (!gender) {
      failAttendee('Main attendee gender is required');
      return;
    }
    // Extra guests' name + gender are required (WhatsApp number stays
    // optional) — the organizer's own guest list needs a real name per
    // ticket, not just a headcount.
    if (ticketCount > 1) {
      for (let i = 0; i < ticketCount - 1; i++) {
        if (!(guestNames[i] ?? '').trim() || !guestGenders[i]) {
          failAttendee(`Guest ${i + 2}'s name and gender are required`);
          return;
        }
      }
    }
    // Email is optional too — only the emailed PDF depends on it (WhatsApp
    // confirmation and in-app My Bookings both work without one), so a typo
    // or a skipped field here shouldn't be able to block payment. Still
    // validated *if* filled in, since a bad address silently blackholes the
    // real ticket PDF with no other signal that it happened.
    if (email.trim() && !EMAIL_RE.test(email.trim())) {
      failAttendee('That email address doesn\'t look right');
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
          <Link to={eventPath(eventCity(event) ?? city, event.slug)}>← {event.title}</Link> / Checkout · step 2 of 2 ·{' '}
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
            <div id="attendee-details" className="card" style={{ marginBottom: 18 }}>
              <h3 style={{ marginBottom: 14 }}>Attendee details</h3>
              {!showMainFields ? (
                <>
                  <div className="field" style={{ display: 'flex', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12, width: '100%' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{ position: 'relative', flexShrink: 0 }}>
                        <button
                          type="button"
                          className="avatar"
                          onClick={() => avatarInputRef.current?.click()}
                          disabled={avatarBusy}
                          title={avatarUrl ? 'Change photo' : 'Add a photo (optional)'}
                          style={{
                            width: 52, height: 52, fontSize: 22, cursor: 'pointer', padding: 0,
                            ...(avatarUrl ? { backgroundImage: `url(${avatarUrl})`, backgroundSize: 'cover', backgroundPosition: 'center' } : {}),
                          }}
                        >
                          {avatarBusy ? '…' : !avatarUrl && '👤'}
                        </button>
                        <span
                          style={{
                            position: 'absolute', bottom: -2, right: -2, width: 20, height: 20, borderRadius: '50%',
                            background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 10, border: '2px solid var(--surface, #16170f)', pointerEvents: 'none',
                          }}
                        >
                          📷
                        </span>
                        <input
                          ref={avatarInputRef}
                          type="file"
                          accept="image/*"
                          style={{ display: 'none' }}
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            e.target.value = '';
                            if (f) uploadAvatar(f);
                          }}
                        />
                      </div>
                      <div>
                        <div className="bold">{name}</div>
                        <div className="tiny muted">{whatsapp}{gender ? ` · ${gender}` : ''}</div>
                      </div>
                    </div>
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setEditMain(true)}>
                      Not you? Edit
                    </button>
                  </div>
                  {avatarErr && <div className="tiny danger-text" style={{ marginTop: 6 }}>{avatarErr}</div>}
                </>
              ) : (
                <>
                  <div className="field">
                    <span>Full name (main attendee) *</span>
                    <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="form-row">
                    <div className="field">
                      <span>Gender *</span>
                      <select value={gender} onChange={(e) => setGender(e.target.value)}>
                        <option value="">Select…</option>
                        <option>Female</option>
                        <option>Male</option>
                        <option>Non-binary</option>
                        <option>Prefer not to say</option>
                      </select>
                    </div>
                    <div className="field">
                      <span>WhatsApp number *</span>
                      <input value={whatsapp} onChange={(e) => setWhatsapp(e.target.value)} placeholder="+91" />
                    </div>
                  </div>
                </>
              )}
              {ticketCount > 1 && (
                <>
                  <div className="small muted" style={{ marginBottom: 12 }}>
                    Name and gender are required for each guest — you'll show one QR for the whole group at the door.
                  </div>
                  {Array.from({ length: ticketCount - 1 }, (_, i) => (
                    <div key={i} className="form-row">
                      <div className="field">
                        <span>Guest {i + 2} name *</span>
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
                        <span>Gender *</span>
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
                <span>Email (optional)</span>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@mail.com — for your ticket PDF" />
              </div>
              <div className="small muted">
                🎟 Tickets sent to WhatsApp <span className="bold">{whatsapp || '—'}</span>
                {email.trim() && <> and emailed to <span className="bold">{email}</span></>} <span className="verified">✓</span>
              </div>
              {attendeeErr && (
                <div className="small danger-text" style={{ marginTop: 10 }}>
                  ✕ {attendeeErr}
                </div>
              )}
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
                <button className="btn btn-ghost" style={{ flex: '0 0 auto' }} onClick={() => applyCoupon()} disabled={quoting}>
                  Apply
                </button>
              </div>
              {couponMsg && (
                <div className={`small ${couponMsg.ok ? 'accent' : 'danger-text'}`} style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span>{couponMsg.ok ? '✓ ' : '✕ '}{couponMsg.text}</span>
                  {appliedCode && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={clearCoupon}>
                      Remove
                    </button>
                  )}
                </div>
              )}
              {availCoupons.length > 0 && (
                <div style={{ marginTop: 12 }}>
                  <div className="tiny muted" style={{ marginBottom: 8 }}>Available for this event</div>
                  <div className="chip-row">
                    {availCoupons.map((c) => {
                      const benefit = c.type === 'percent'
                        ? `${c.value}% off${c.maxDiscount ? ` up to ₹${c.maxDiscount}` : ''}`
                        : `₹${c.value} off`;
                      const isApplied = appliedCode === c.code;
                      return (
                        <button
                          key={c.code}
                          type="button"
                          className={`chip ${isApplied ? 'on' : ''}`}
                          disabled={quoting || isApplied}
                          onClick={() => applyCoupon(c.code)}
                          title={c.description ?? undefined}
                        >
                          {isApplied ? '✓ ' : ''}{c.code} · {benefit}
                        </button>
                      );
                    })}
                  </div>
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
                <span>{formatPrice(l.qty * l.tier.price)}</span>
              </div>
            ))}
            {promoterMarkupApplies && (
              <>
                <div className="kv">
                  <span className="k">Promoter referral</span>
                  <span>₹{promoterShare}</span>
                </div>
                <div className="kv">
                  <span className="k">Prebooze commission</span>
                  <span>₹{platformShare}</span>
                </div>
              </>
            )}
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
              <span>{quotePending ? 'Calculating…' : formatPrice(finalTotal)}</span>
            </div>
            <button className="btn btn-pri btn-block btn-lg" onClick={pay} disabled={paying || (liveEvent ? !holdId : false) || quoting || quotePending}>
              {paying ? 'Processing…' : quotePending ? 'Calculating…' : finalTotal === 0 ? 'Get free ticket' : `Pay ₹${finalTotal}`}
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
