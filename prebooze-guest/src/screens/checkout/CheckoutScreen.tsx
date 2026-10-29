import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import * as ExpoLinking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, CreditCard, Hourglass, Lock, Megaphone, Smartphone, XCircle } from 'lucide-react-native';
import { catalog } from '../../api/catalog';
import { bookingsApi, type AvailableCoupon, type BookingQuote, type CreateBookingInput } from '../../api/bookings';
import { wallet } from '../../api/wallet';
import { platform, type PlatformInfo } from '../../api/platform';
import { auth } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { ApiError } from '../../api/client';
import { absoluteUrl } from '../../lib/urls';
import { existingRole, roleLabel } from '../../lib/roles';
import { requiredAgeFor } from '../../lib/ageGate';
import { partySizeFromTierName, isCoupleTierName } from '../../lib/partySize';
import { displayTierPrice, tierCountdownLabel } from '../../lib/ticketTierPricing';
import { useTicker } from '../../lib/useTicker';
import { captureCart, clearResumeCart } from '../../lib/cartTracker';
import { trackPurchase } from '../../lib/analytics';
import { haptics } from '../../lib/haptics';
import { scheduleEventDayNotification } from '../../lib/eventDayNotification';
import { sanitizeName, sanitizePhoneDigits, isValidName, isValidWhatsapp } from '../../lib/attendeeValidation';
import { Button, Chip, Checkbox, IconButton, Muted, Screen, Txt } from '../../components/ui';
import AvatarUploadBox from '../../components/AvatarUploadBox';
import { colors, fontFamily, fontSize, radius, spacing } from '../../theme/tokens';
import type { RootStackParamList } from '../../navigation/types';
import type { Booking, Event, PayMethod } from '../../types';
import { KeyboardAwareScrollView } from 'react-native-keyboard-aware-scroll-view';

type Nav = NativeStackNavigationProp<RootStackParamList>;
type Rt = { key: string; name: 'Checkout'; params: RootStackParamList['Checkout'] };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ABSORBED_NOTE: Record<string, string> = {
  Organizer: 'absorbed by the organizer',
  Guest: 'paid by you',
  Split: 'split between you and the organizer',
};
const GENDERS = ['Female', 'Male', 'Non-binary', 'Prefer not to say'];

/** Real hold → quote → PhonePe (in-app browser, same full hosted-page
 * redirect web does, via expo-web-browser instead of a page navigation) →
 * poll pay/status → create flow. No mock/fake payment path — mirrors
 * prebooze-web's Checkout.tsx feature-for-feature: live 8-min hold
 * countdown, per-guest name/gender/phone for Couple/Group tiers, Couple
 * gender-pair door-policy validation, age confirmation, coupon codes,
 * wallet credit, saved payment methods, and the real server-priced quote
 * breakdown (fee/GST/promoter split/discount/credit), not a client
 * estimate. */
export default function CheckoutScreen() {
  const navigation = useNavigation<Nav>();
  const route = useRoute() as Rt;
  const { user, refreshUser } = useAuth();
  const { eventSlug, qty, promoterRef, promoterVia } = route.params;
  useTicker(60_000); // keeps the free-entry countdown line live

  const [event, setEvent] = useState<Event | null>(null);
  const [loadErr, setLoadErr] = useState('');
  const [holdId, setHoldId] = useState<string | null>(null);
  const [holdExpiry, setHoldExpiry] = useState<number | null>(null);
  const [holdErr, setHoldErr] = useState('');
  const [now, setNow] = useState(Date.now());
  const [info, setInfo] = useState<PlatformInfo | null>(null);
  const [myEventBookings, setMyEventBookings] = useState<Booking[]>([]);
  const [payMethods, setPayMethods] = useState<PayMethod[]>([]);
  const [walletBalance, setWalletBalance] = useState(0);
  const [availCoupons, setAvailCoupons] = useState<AvailableCoupon[]>([]);
  const [refPromoterName, setRefPromoterName] = useState<string | null>(null);

  const [name, setName] = useState(user?.name ?? '');
  const [gender, setGender] = useState(user?.gender ?? '');
  const [ageInput, setAgeInput] = useState('');
  // user.phone comes in as "+91 XXXXXXXXXX" (see PhoneEntryScreen) — strip
  // to the bare 10-digit number so it starts out already matching
  // isValidWhatsapp, not failing validation on an unedited prefilled field.
  const [whatsapp, setWhatsapp] = useState(sanitizePhoneDigits(user?.phone ?? ''));
  const [email, setEmail] = useState(user?.email ?? '');
  const [editMain, setEditMain] = useState(false);
  const [guestNames, setGuestNames] = useState<string[]>([]);
  const [guestGenders, setGuestGenders] = useState<string[]>([]);
  const [guestPhones, setGuestPhones] = useState<string[]>([]);
  const [couponInput, setCouponInput] = useState('');
  const [couponMsg, setCouponMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [appliedCode, setAppliedCode] = useState<string | null>(null);
  const [useCredit, setUseCredit] = useState(true);
  const [payMethod, setPayMethod] = useState('phonepe');
  const [attendeeErr, setAttendeeErr] = useState('');
  const [paying, setPaying] = useState(false);
  const [quote, setQuote] = useState<BookingQuote | null>(null);
  const [quoting, setQuoting] = useState(false);
  const [paymentFailed, setPaymentFailed] = useState<'failed' | 'unknown' | 'paidButUnconfirmed' | 'cancelled' | null>(null);
  const scrollRef = useRef<KeyboardAwareScrollView>(null);
  const attendeeY = useRef(0);

  useEffect(() => {
    catalog.event(eventSlug).then(setEvent).catch(() => setLoadErr("Couldn't load this event."));
    platform.settings().then(setInfo).catch(() => {});
    wallet.balance().then((w) => setWalletBalance(w.balance)).catch(() => {});
    wallet.payMethods().then(setPayMethods).catch(() => {});
    bookingsApi.list().then((all) => setMyEventBookings(all.filter((b) => b.status === 'confirmed'))).catch(() => {});
  }, [eventSlug]);

  useEffect(() => {
    if (!event) return;
    bookingsApi.availableCoupons(event.id).then(setAvailCoupons).catch(() => setAvailCoupons([]));
  }, [event?.id]);

  // Real lookup — the referral banner only shows once the shared promoter
  // slug resolves to a real, currently-active promoter, never just the raw
  // slug from the link.
  useEffect(() => {
    if (!promoterRef) return;
    catalog.promoter(promoterRef).then((p) => setRefPromoterName(p.name)).catch(() => {});
  }, [promoterRef]);

  // Real 8-min server hold — created once, reused across re-renders (never
  // re-held just because this effect re-runs).
  useEffect(() => {
    if (!event || holdId) return;
    bookingsApi.hold(event.id, qty)
      .then((h) => { setHoldId(h.holdId); setHoldExpiry(new Date(h.expiresAt).getTime()); })
      .catch((e) => setHoldErr(e instanceof ApiError ? e.message : 'Could not hold your tickets — they may have sold out'));
  }, [event, holdId, qty]);

  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  // Known guest (already been through checkout before) starts collapsed —
  // same "Not you? Edit" pattern web uses, just without the avatar upload
  // (that's a profile-page concern, not essential at checkout).
  const knownGuest = Boolean(user?.name?.trim() && user?.phone?.trim() && user?.gender);
  const showMainFields = !knownGuest || editMain;

  const lines = useMemo(() => {
    if (!event) return [];
    return event.tiers.filter((t) => (qty[t.id] ?? 0) > 0).map((t) => ({ tier: t, qty: qty[t.id] }));
  }, [event, qty]);

  const ticketCount = lines.reduce((a, l) => a + l.qty, 0);
  const attendeeSlots = useMemo(
    () => lines.flatMap((l) => Array.from({ length: l.qty * partySizeFromTierName(l.tier.name) }, () => l.tier.name)),
    [lines],
  );
  const extraSlots = attendeeSlots.slice(1);
  const subtotal = event ? lines.reduce((a, l) => a + l.qty * displayTierPrice(l.tier, event.date), 0) : 0;

  // Device-local "resume checkout" capture — same reasoning as web's
  // captureCart effect (AppContext/Checkout.tsx): no backend guest-cart
  // endpoint, this is purely a same-device nudge if the guest leaves
  // before paying. Captured once per checkout entry.
  useEffect(() => {
    if (!event || lines.length === 0) return;
    captureCart({
      eventId: event.id,
      eventSlug: event.slug,
      eventTitle: event.title,
      qty,
      ticketCount,
      tierSummary: lines.map((l) => `${l.qty}× ${l.tier.name}`).join(', '),
      total: subtotal,
      updatedAt: new Date().toISOString(),
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  const requiredAge = event ? requiredAgeFor(event.ageLimit) : null;
  const needsAgeConfirm = requiredAge !== null && (!user?.age || user.age < requiredAge);

  // Server-priced quote — re-fetched whenever the coupon/credit choice
  // changes. Never trusted client-side for the real total; this IS the
  // real total once it lands.
  useEffect(() => {
    if (!holdId) return;
    let cancelled = false;
    setQuoting(true);
    const returnUrl = ExpoLinking.createURL('checkout-return', { queryParams: { holdId } });
    bookingsApi.quote(holdId, appliedCode ?? undefined, useCredit ? walletBalance : 0, promoterRef, returnUrl)
      .then((q) => {
        if (cancelled) return;
        setQuote(q);
        if (appliedCode) setCouponMsg({ ok: true, text: `${appliedCode} applied — you save ₹${q.discount}` });
      })
      .catch((e) => {
        if (cancelled) return;
        if (appliedCode) {
          setCouponMsg({ ok: false, text: e instanceof ApiError ? e.message : `"${appliedCode}" isn't valid for this event` });
          setAppliedCode(null);
        }
      })
      .finally(() => { if (!cancelled) setQuoting(false); });
    return () => { cancelled = true; };
  }, [holdId, appliedCode, useCredit, walletBalance, promoterRef]);

  const quotePending = subtotal > 0 && !quote;
  const finalFee = quote?.fee ?? 0;
  const finalGst = quote?.gst ?? 0;
  const finalGstPct = quote?.gstPct ?? 0;
  const finalIgst = quote?.igstAmount ?? 0;
  const finalCgst = quote?.cgstAmount ?? 0;
  const finalSgst = quote?.sgstAmount ?? 0;
  const finalDiscount = quote?.discount ?? 0;
  const finalCredit = quote?.walletCreditUsed ?? 0;
  const finalTotal = quote?.total ?? subtotal;
  const promoterMarkupApplies = quote?.promoterMarkupApplies ?? false;

  const remaining = holdExpiry ? Math.max(0, holdExpiry - now) : 0;
  const expired = holdExpiry != null && holdExpiry <= now;
  const lowTime = remaining <= 60_000;
  const mmss = `${String(Math.floor(remaining / 60000)).padStart(2, '0')}:${String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0')}`;

  const applyCoupon = useCallback((codeOverride?: string) => {
    const code = (codeOverride ?? couponInput).trim().toUpperCase();
    if (!code) return;
    setCouponInput(code);
    setAppliedCode(code);
  }, [couponInput]);

  const clearCoupon = useCallback(() => {
    setAppliedCode(null);
    setCouponInput('');
    setCouponMsg(null);
  }, []);

  const failAttendee = (msg: string) => {
    setAttendeeErr(msg);
    scrollRef.current?.scrollToPosition(0, Math.max(0, attendeeY.current - spacing.l), true);
  };

  // Real gap: web's Attendee details card shows the guest's real photo
  // (uploadable right from checkout) next to the collapsed name/phone row
  // — this screen only ever showed plain text, no avatar at all. Mirrors
  // web's uploadAvatar: a new photo updates the guest's real profile, not
  // just this screen's local state, same as EditProfileScreen's own save.
  const onAvatarChange = async (url: string | null) => {
    if (!url) return;
    await auth.updateMe({ avatarUrl: url }).catch(() => {});
    refreshUser();
  };

  /** Same attendee-form validation every pay path needs, run before any
   * payment method is even selected — returns the booking payload or null
   * (having already set the error) if something's missing. */
  const validateAttendees = (): Omit<CreateBookingInput, 'holdId' | 'phonepe'> | null => {
    if (expired) {
      setAttendeeErr('Your hold just expired — please pick tickets again');
      return null;
    }
    setAttendeeErr('');
    if (!name.trim() || !whatsapp.trim()) { failAttendee('Main attendee name and WhatsApp number are required'); return null; }
    if (!isValidName(name)) { failAttendee('Enter a real name — letters and spaces only, no numbers or symbols'); return null; }
    if (!isValidWhatsapp(whatsapp)) { failAttendee('Enter a valid 10-digit WhatsApp number'); return null; }
    if (!gender) { failAttendee('Main attendee gender is required'); return null; }
    if (needsAgeConfirm) {
      const n = parseInt(ageInput, 10);
      if (!ageInput.trim() || Number.isNaN(n) || n <= 0) { failAttendee('Please confirm your age to continue'); return null; }
      if (requiredAge !== null && n < requiredAge) { failAttendee(`This event is ${event!.ageLimit} — you don't meet the age requirement`); return null; }
    }
    for (let i = 0; i < extraSlots.length; i++) {
      const gName = (guestNames[i] ?? '').trim();
      if (!gName || !guestGenders[i]) { failAttendee(`Guest ${i + 2}'s name and gender are required`); return null; }
      if (!isValidName(gName)) { failAttendee(`Guest ${i + 2}'s name must be letters and spaces only, no numbers or symbols`); return null; }
      const gPhone = (guestPhones[i] ?? '').trim();
      if (gPhone && !isValidWhatsapp(gPhone)) { failAttendee(`Guest ${i + 2}'s WhatsApp number must be a valid 10-digit number`); return null; }
    }
    {
      const flatGenders = [gender, ...guestGenders];
      let cursor = 0;
      for (const l of lines) {
        const per = partySizeFromTierName(l.tier.name);
        if (isCoupleTierName(l.tier.name)) {
          for (let t = 0; t < l.qty; t++) {
            const pair = flatGenders.slice(cursor, cursor + 2);
            if (!(pair.includes('Male') && pair.includes('Female'))) { failAttendee(`"${l.tier.name}" tickets need one male and one female guest per pair`); return null; }
            cursor += 2;
          }
        } else {
          cursor += l.qty * per;
        }
      }
    }
    if (email.trim() && !EMAIL_RE.test(email.trim())) { failAttendee("That email address doesn't look right"); return null; }
    if (!holdId || !event) return null;

    const guestsPayload = extraSlots.length > 0
      ? extraSlots.map((_, i) => ({
          name: (guestNames[i] ?? '').trim(),
          gender: guestGenders[i] || undefined,
          whatsapp: (guestPhones[i] ?? '').trim(),
        })).filter((g) => g.name)
      : undefined;
    const confirmedAge = needsAgeConfirm ? parseInt(ageInput, 10) : undefined;
    return {
      mainGuest: name.trim(),
      mainGuestGender: gender || undefined,
      age: confirmedAge,
      whatsapp: whatsapp.trim(),
      guests: guestsPayload,
      couponCode: appliedCode ?? undefined,
      walletCredit: useCredit ? walletBalance : 0,
      promoterRef,
      promoterVia,
      payMethodId: payMethods.some((m) => m.id === payMethod) ? payMethod : undefined,
    };
  };

  /** The main "Pay ₹X" button — validates, mints a fresh PhonePe hosted-
   * checkout order, and opens it in an in-app browser tab. This is the
   * only checkout flow — the native PhonePe SDK (PAY_PAGE mode) and a
   * custom Prebooze-built method picker were both tried and removed
   * 2026-10-13: PAY_PAGE rendered a broken/unresponsive internal WebView,
   * and the custom picker wasn't the UX wanted.
   *
   * Uses openAuthSessionAsync, not openBrowserAsync — a real bug, not a
   * guess: confirmed directly against expo-web-browser's own docs
   * 2026-10-13. On Android, openBrowserAsync resolves the instant the tab
   * *opens* (not closes), and dismissBrowser() is iOS-only (silently a
   * no-op on Android, always swallowed by its .catch). That combination
   * can never close the tab programmatically on Android — paired with the
   * JS thread being throttled while backgrounded behind the tab, this is
   * what caused the "something went wrong"/stuck-after-payment bug:
   * execution would stall until the guest manually closed the tab
   * themselves. openAuthSessionAsync is the pairing actually documented to
   * block until the tab closes on both platforms, which is what the very
   * first successful real-payment test in this app used before later
   * experiments swapped it out. The custom-scheme returnUrl lets it detect
   * PhonePe's own redirect and close itself; a verified HTTPS App Link
   * isn't set up yet, so Chrome shows a one-time "Open Prebooze?"
   * confirmation on that redirect — a single tap, not a stuck screen. The
   * redirect is still never trusted as proof of payment either way — only
   * the payStatus poll below is. A free (₹0) booking skips straight to
   * confirmation. */
  const pay = async () => {
    const payload = validateAttendees();
    if (!payload || !holdId) return;
    setPaying(true);
    try {
      if (email.trim() !== (user?.email ?? '')) {
        await auth.updateMe({ email: email.trim() }).catch(() => {});
      }
      const returnUrl = ExpoLinking.createURL('checkout-return', { queryParams: { holdId } });
      const q = await bookingsApi.quote(holdId, appliedCode ?? undefined, useCredit ? walletBalance : 0, promoterRef, returnUrl);
      if (!(q.total > 0 && q.phonepeRedirectUrl && q.phonepeMerchantOrderId)) {
        const booking = await bookingsApi.create({ holdId, ...payload });
        clearResumeCart();
        trackPurchase({
          id: booking.id, total: booking.total, tierId: booking.tierId, tierName: booking.tierName,
          eventTitle: booking.event?.title ?? event?.title, qty: booking.qty, tierPrice: booking.qty ? booking.subtotal / booking.qty : booking.subtotal,
        });
        haptics.success();
        scheduleEventDayNotification(booking).catch(() => {});
        navigation.replace('BookingConfirmed', { bookingId: booking.id });
        return;
      }
      // Awaited (not fire-and-forget) — same reasoning as the web
      // Checkout.tsx fix: the webhook/cron recovery sweep needs a real
      // Cart.bookingPayload to work from if the guest never comes back at
      // all, and a background fetch racing openAuthSessionAsync isn't
      // guaranteed to win that race on every OS/browser combination. Never
      // blocks the actual payment — swallowed below either way.
      await bookingsApi.prepare({ holdId, ...payload }).catch(() => {});
      const result = await WebBrowser.openAuthSessionAsync(q.phonepeRedirectUrl, returnUrl).catch(() => null);
      // The redirect closing the tab is never trusted alone — still poll
      // the server's own getOrderStatus check regardless of how/why the
      // tab closed (redirect, manual close, or a stale openAuthSessionAsync
      // result on some OEM browsers), since payment can genuinely succeed
      // in the instant before a manual close too. But an explicit close
      // (the guest closed the tab themselves, never hit any redirect) gets
      // a short confirmatory poll instead of the full ~6.5min budget — that
      // full budget exists for an in-progress UPI/bank-auth wait, which
      // can't be happening if the tab was dismissed before any redirect.
      // iOS reports two distinct manual-close types — 'cancel' (e.g. swipe
      // down) and 'dismiss' (tapping the browser's own close/X button,
      // WebBrowserResultType.DISMISS) — real bug: only checking 'cancel'
      // missed the X-button case entirely, which fell through to the full
      // budget and looked exactly like an infinite hang. Android only ever
      // reports 'dismiss' here (no 'cancel' on that platform), so this also
      // covers Android's own equivalent manual-close case.
      const isExplicitCancel = result?.type === 'cancel' || result?.type === 'dismiss';
      const status = await pollPayStatus(holdId, isExplicitCancel ? 8 : 260);
      if (status !== 'paid') {
        setPaymentFailed(status === 'failed' ? 'failed' : isExplicitCancel ? 'cancelled' : 'unknown');
        setPaying(false);
        return;
      }
      // Payment is confirmed at this point — any failure from here on is
      // never shown as attendeeErr (the plain checkout-form error), because
      // that reads as "your payment didn't go through" when it actually
      // did. Real bug hit 2026-10-13: a guest's payment succeeded for real
      // (webhook landed, Booking row existed) but a transient failure
      // looking it up showed the generic "Something went wrong" on the
      // checkout form itself — no indication the money was ever taken.
      try {
        // The prepare() snapshot above + a server-side webhook can already
        // have created this exact booking by the time we get here. A few
        // short retries because the webhook can land a couple of seconds
        // after our own getOrderStatus poll already saw 'paid' — not
        // finding it on the first try isn't proof it doesn't exist yet.
        let already: Booking | undefined;
        for (let i = 0; i < 5 && !already; i++) {
          if (i > 0) await new Promise((r) => setTimeout(r, 1500));
          already = await bookingsApi.list().then((all) => all.find((b) => b.paymentId === q.phonepeMerchantOrderId)).catch(() => undefined);
        }
        const booking = already ?? await bookingsApi.create({ holdId, ...payload, phonepe: { merchantOrderId: q.phonepeMerchantOrderId } });
        clearResumeCart();
        // Only fired for the booking this exact call actually created/found
        // just now, never on a re-render — `pay()` only runs once per tap,
        // so there's no risk of double-counting the same purchase.
        trackPurchase({
          id: booking.id, total: booking.total, tierId: booking.tierId, tierName: booking.tierName,
          eventTitle: booking.event?.title ?? event?.title, qty: booking.qty, tierPrice: booking.qty ? booking.subtotal / booking.qty : booking.subtotal,
        });
        haptics.success();
        scheduleEventDayNotification(booking).catch(() => {});
        navigation.replace('BookingConfirmed', { bookingId: booking.id });
      } catch {
        setPaymentFailed('paidButUnconfirmed');
        setPaying(false);
      }
    } catch (e) {
      setAttendeeErr(e instanceof ApiError ? e.message : 'Something went wrong — please try again.');
      setPaying(false);
    }
  };

  if (loadErr) {
    return (
      <Screen style={styles.center}>
        <Muted>{loadErr}</Muted>
        <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: spacing.l }} />
      </Screen>
    );
  }

  if (!event) {
    return (
      <Screen style={styles.center}>
        <ActivityIndicator color={colors.accent} />
      </Screen>
    );
  }

  const roleBlocked = existingRole(user);
  if (roleBlocked) {
    return (
      <Screen style={styles.center}>
        <Lock size={32} color={colors.muted} />
        <Txt style={styles.blockedTitle}>{roleLabel(roleBlocked)} accounts can't book tickets</Txt>
        <Muted style={styles.blockedSub}>
          This number is registered as a {roleLabel(roleBlocked).toLowerCase()} — a business account. Use a personal number to book as a guest.
        </Muted>
        <Button label="Back" variant="ghost" onPress={() => navigation.goBack()} style={{ marginTop: spacing.l }} />
      </Screen>
    );
  }

  if (holdErr) {
    return (
      <Screen style={styles.center}>
        <Clock size={32} color={colors.danger} />
        <Txt style={styles.blockedTitle}>{holdErr}</Txt>
        <Button label="Pick tickets again →" onPress={() => navigation.goBack()} style={{ marginTop: spacing.l }} />
      </Screen>
    );
  }

  if (expired) {
    return (
      <Screen style={styles.center}>
        <Clock size={32} color={colors.danger} />
        <Txt style={styles.blockedTitle}>Your hold expired</Txt>
        <Muted style={styles.blockedSub}>
          We held your {ticketCount} ticket{ticketCount > 1 ? 's' : ''} for a few minutes. Pick them again to continue — popular tiers can sell out fast.
        </Muted>
        <Button label="Pick tickets again →" onPress={() => navigation.goBack()} style={{ marginTop: spacing.l }} />
      </Screen>
    );
  }

  if (paymentFailed) {
    const titles = {
      failed: 'Payment failed',
      unknown: "Couldn't confirm your payment",
      paidButUnconfirmed: 'Payment received',
      cancelled: 'Payment cancelled',
    } as const;
    const subs = {
      failed: 'The payment was declined or cancelled. No amount was charged — give it another try.',
      unknown: "We couldn't confirm this with PhonePe yet. If money was deducted, it'll show up in My Bookings shortly — otherwise just try again.",
      cancelled: 'You closed the payment screen before completing it. No amount was charged.',
      // Distinct from the two above on purpose — PhonePe already confirmed
      // this payment succeeded (real bug hit 2026-10-13: the booking was
      // genuinely created, but a transient lookup failure right after made
      // the app show a scary generic error with no mention money was taken
      // at all). Never offer "Try again" here — re-paying risks a real
      // double charge for something that already went through.
      paidButUnconfirmed: "Your payment went through, but your ticket's taking a moment to show up. Check My Bookings in a few seconds — it'll be there.",
    } as const;
    const isPaid = paymentFailed === 'paidButUnconfirmed';
    return (
      <Screen style={styles.center}>
        {isPaid ? <CheckCircle2 size={32} color={colors.accent} /> : <XCircle size={32} color={colors.danger} />}
        <Txt style={styles.blockedTitle}>{titles[paymentFailed]}</Txt>
        <Muted style={styles.blockedSub}>{subs[paymentFailed]}</Muted>
        {!isPaid && <Button label="Try again" onPress={() => setPaymentFailed(null)} style={{ marginTop: spacing.l }} />}
        <Button
          label="Check My Bookings"
          variant={isPaid ? 'primary' : 'ghost'}
          onPress={() => navigation.navigate('Main', { screen: 'Bookings' })}
          style={{ marginTop: isPaid ? spacing.l : spacing.s }}
        />
      </Screen>
    );
  }

  const city = event.venue?.city ?? event.unlistedVenueCity ?? event.privateCity ?? null;
  const location = event.venue?.name ?? event.unlistedVenueName ?? event.privateLocality ?? 'Location shared after booking';

  return (
    <Screen>
      <View style={styles.header}>
        <IconButton onPress={() => navigation.goBack()} disabled={paying}>
          <ArrowLeft size={18} color={colors.text} />
        </IconButton>
        <Txt style={styles.title}>Checkout</Txt>
      </View>

      <KeyboardAwareScrollView enableOnAndroid extraScrollHeight={80} ref={scrollRef} contentContainerStyle={styles.content}>
        {holdExpiry && !expired && (
          <View style={[styles.holdBanner, lowTime && styles.holdBannerLow]}>
            <Hourglass size={18} color={lowTime ? colors.danger : colors.accent} />
            <View style={{ flex: 1 }}>
              <Txt style={styles.holdBannerTitle}>{ticketCount} ticket{ticketCount > 1 ? 's' : ''} held for you</Txt>
              <Muted style={styles.holdBannerSub}>{lowTime ? 'Hurry — your hold is about to expire.' : 'Complete payment before the hold runs out.'}</Muted>
            </View>
            <Txt style={[styles.holdTimer, lowTime && styles.holdTimerLow]}>{mmss}</Txt>
          </View>
        )}

        <View style={styles.sectionCard} onLayout={(e) => { attendeeY.current = e.nativeEvent.layout.y; }}>
          <Txt style={styles.sectionTitle}>Attendee details</Txt>

          {myEventBookings.some((b) => b.eventId === event.id) && (() => {
            const existing = myEventBookings.find((b) => b.eventId === event.id && b.mainGuest.trim().toLowerCase() === name.trim().toLowerCase())
              ?? myEventBookings.find((b) => b.eventId === event.id)!;
            const dup = existing.mainGuest.trim().toLowerCase() === name.trim().toLowerCase();
            return (
              <View style={[styles.dashedNotice, dup && styles.dashedNoticeDanger]}>
                {dup ? <AlertTriangle size={13} color={colors.danger} /> : <CheckCircle2 size={13} color={colors.accent} />}
                <Muted style={styles.dashedNoticeTxt}>
                  {dup
                    ? `You already booked this event as ${existing.mainGuest} — ${existing.tierName}, Booking ${existing.id}. Still want another ticket for the same person?`
                    : `You already have a booking for this event (${existing.tierName}, ${existing.mainGuest}, Booking ${existing.id}). This new one will be for ${name.trim() || 'the attendee below'}.`}
                </Muted>
              </View>
            );
          })()}

          {!showMainFields ? (
            <View style={styles.knownGuestRow}>
              <AvatarUploadBox value={user?.avatarUrl ?? null} onChange={onAvatarChange} size={52} />
              <Pressable style={styles.knownGuestInfo} onPress={() => setEditMain(true)}>
                <Txt style={styles.orgName}>{name}</Txt>
                <Muted style={styles.knownGuestSub}>{whatsapp}{gender ? ` · ${gender}` : ''}</Muted>
              </Pressable>
              <Pressable onPress={() => setEditMain(true)}>
                <Txt style={styles.editLink}>Not you? Edit</Txt>
              </Pressable>
            </View>
          ) : (
            <>
              <Txt style={styles.fieldLabel}>Full name (main attendee) *</Txt>
              <TextInput value={name} onChangeText={(v) => setName(sanitizeName(v))} placeholder="Full name" placeholderTextColor={colors.muted} style={styles.input} editable={!paying} />
              <Txt style={styles.fieldLabel}>Gender *</Txt>
              <View style={styles.chipRow}>
                {GENDERS.map((g) => <Chip key={g} label={g} active={gender === g} onPress={() => setGender(g)} />)}
              </View>
              <Txt style={styles.fieldLabel}>WhatsApp number *</Txt>
              <TextInput value={whatsapp} onChangeText={(v) => setWhatsapp(sanitizePhoneDigits(v))} placeholder="10-digit WhatsApp number" placeholderTextColor={colors.muted} keyboardType="number-pad" maxLength={10} style={styles.input} editable={!paying} />
            </>
          )}

          {needsAgeConfirm && (
            <>
              <Txt style={styles.fieldLabel}>Confirm your age *</Txt>
              <TextInput value={ageInput} onChangeText={setAgeInput} placeholder="Age" placeholderTextColor={colors.muted} keyboardType="number-pad" style={styles.input} editable={!paying} />
              <Muted style={styles.hint}>This event is {event.ageLimit} — we need to confirm you meet the age requirement.</Muted>
            </>
          )}

          {extraSlots.length > 0 && (
            <>
              <Muted style={styles.hint}>
                Name and gender are required for each guest — a Couple/Group tier needs a name per person, not per ticket. You'll show one QR for the whole group at the door.
              </Muted>
              {extraSlots.map((tierName, i) => (
                <View key={i} style={styles.guestBlock}>
                  <Txt style={styles.fieldLabel}>Guest {i + 2} name * <Muted style={styles.fieldLabelHint}>({tierName})</Muted></Txt>
                  <TextInput
                    value={guestNames[i] ?? ''}
                    onChangeText={(v) => setGuestNames((g) => { const next = [...g]; next[i] = sanitizeName(v); return next; })}
                    placeholder={`Guest ${i + 2} full name`}
                    placeholderTextColor={colors.muted}
                    style={styles.input}
                    editable={!paying}
                  />
                  <Txt style={styles.fieldLabel}>Gender *</Txt>
                  <View style={styles.chipRow}>
                    {GENDERS.map((g) => (
                      <Chip key={g} label={g} active={guestGenders[i] === g} onPress={() => setGuestGenders((prev) => { const next = [...prev]; next[i] = g; return next; })} />
                    ))}
                  </View>
                  <Txt style={styles.fieldLabel}>WhatsApp number</Txt>
                  <TextInput
                    value={guestPhones[i] ?? ''}
                    onChangeText={(v) => setGuestPhones((g) => { const next = [...g]; next[i] = sanitizePhoneDigits(v); return next; })}
                    placeholder="10-digit WhatsApp number"
                    placeholderTextColor={colors.muted}
                    keyboardType="number-pad"
                    maxLength={10}
                    style={styles.input}
                    editable={!paying}
                  />
                </View>
              ))}
            </>
          )}

          <Txt style={styles.fieldLabel}>Email (optional)</Txt>
          <TextInput value={email} onChangeText={setEmail} placeholder="you@mail.com — for your ticket PDF" placeholderTextColor={colors.muted} keyboardType="email-address" autoCapitalize="none" style={styles.input} editable={!paying} />

          {!!attendeeErr && (
            <View style={styles.attendeeErrRow}>
              <XCircle size={13} color={colors.danger} />
              <Txt style={styles.attendeeErrTxt}>{attendeeErr}</Txt>
            </View>
          )}
        </View>

        {subtotal > 0 && (
          <View style={styles.sectionCard}>
            <Txt style={styles.sectionTitle}>Apply coupon</Txt>
            <View style={styles.couponRow}>
              <TextInput value={couponInput} onChangeText={setCouponInput} placeholder="Coupon code" placeholderTextColor={colors.muted} style={[styles.input, { flex: 1 }]} editable={!quoting} autoCapitalize="characters" />
              <Button label="Apply" variant="ghost" disabled={quoting} onPress={() => applyCoupon()} style={styles.applyBtn} />
            </View>
            {couponMsg && (
              <View style={styles.couponMsgRow}>
                {couponMsg.ok ? <CheckCircle2 size={13} color={colors.accent} /> : <XCircle size={13} color={colors.danger} />}
                <Txt style={[styles.couponMsgTxt, { color: couponMsg.ok ? colors.accent : colors.danger }]}>{couponMsg.text}</Txt>
                {appliedCode && <Pressable onPress={clearCoupon}><Txt style={styles.editLink}>Remove</Txt></Pressable>}
              </View>
            )}
            {availCoupons.length > 0 && (
              <View style={{ marginTop: spacing.m }}>
                <Muted style={styles.hint}>Available for this event</Muted>
                <View style={[styles.chipRow, { marginTop: spacing.s }]}>
                  {availCoupons.map((c) => {
                    const benefit = c.type === 'percent' ? `${c.value}% off${c.maxDiscount ? ` up to ₹${c.maxDiscount}` : ''}` : `₹${c.value} off`;
                    return (
                      <Chip key={c.code} label={`${c.code} · ${benefit}`} active={appliedCode === c.code} onPress={() => applyCoupon(c.code)} />
                    );
                  })}
                </View>
              </View>
            )}
          </View>
        )}

        {subtotal > 0 && (
          <View style={styles.sectionCard}>
            <Txt style={styles.sectionTitle}>Pay with</Txt>
            {[
              ...payMethods.map((m) => ({ id: m.id, icon: m.type === 'upi' ? Smartphone : CreditCard, label: `${m.label}${m.isDefault ? ' · default' : ''} (saved)` })),
              { id: 'phonepe', icon: null, label: 'PhonePe — UPI / cards / netbanking' },
            ].map((m) => (
              <Pressable key={m.id} style={styles.payOptRow} onPress={() => setPayMethod(m.id)}>
                <View style={[styles.radioOuter, payMethod === m.id && styles.radioOuterOn]}>
                  {payMethod === m.id && <View style={styles.radioInner} />}
                </View>
                {m.icon && <m.icon size={14} color={colors.text} />}
                <Txt style={styles.payOptLabel}>{m.label}</Txt>
              </Pressable>
            ))}
          </View>
        )}

        {!!refPromoterName && (
          <View style={styles.refBanner}>
            <Megaphone size={13} color={colors.accent} />
            <Txt style={styles.refBannerTxt}>Referred by <Txt style={styles.refBannerName}>{refPromoterName}</Txt> — they'll be credited for your booking.</Txt>
          </View>
        )}

        <View style={styles.summaryCard}>
          <Txt style={styles.eventTitle}>{event.title}</Txt>
          <Muted style={styles.eventMeta}>
            {fmtDate(event.date)} · {fmtTime(event.date)} · {location}{city ? `, ${city}` : ''}
          </Muted>

          {lines.map((l) => {
            const countdown = event ? tierCountdownLabel(l.tier, event.date) : null;
            return (
              <View key={l.tier.id} style={{ marginBottom: 6 }}>
                <View style={styles.kvRow}>
                  <Muted>{l.qty} × {l.tier.name}</Muted>
                  <Muted>₹{l.qty * displayTierPrice(l.tier, event.date)}</Muted>
                </View>
                {!!countdown && (
                  <View style={styles.countdownRow}>
                    <Hourglass size={11} color={colors.accent} />
                    <Txt style={styles.countdownTxt}>{countdown} left at this price</Txt>
                  </View>
                )}
              </View>
            );
          })}

          {promoterMarkupApplies && (
            <>
              <View style={styles.kvRow}><Muted>Promoter referral</Muted><Muted>₹{quote?.promoterShare ?? 0}</Muted></View>
              <View style={styles.kvRow}><Muted>Prebooze commission</Muted><Muted>₹{quote?.platformShare ?? 0}</Muted></View>
            </>
          )}

          {subtotal > 0 && (
            <View style={styles.kvRow}>
              <Muted>{info?.feeLabel ?? 'Booking fee'} <Muted style={styles.feeNote}>({ABSORBED_NOTE[info?.absorbedBy ?? 'Guest'] ?? ABSORBED_NOTE.Guest})</Muted></Muted>
              <Muted>{quotePending ? '…' : `₹${finalFee}`}</Muted>
            </View>
          )}
          {finalGst > 0 && (
            finalIgst > 0 ? (
              <View style={styles.kvRow}><Muted>IGST ({finalGstPct}%)</Muted><Muted>₹{finalIgst}</Muted></View>
            ) : (
              <>
                <View style={styles.kvRow}><Muted>CGST ({finalGstPct / 2}%)</Muted><Muted>₹{finalCgst}</Muted></View>
                <View style={styles.kvRow}><Muted>SGST ({finalGstPct / 2}%)</Muted><Muted>₹{finalSgst}</Muted></View>
              </>
            )
          )}
          {finalDiscount > 0 && (
            <View style={styles.kvRow}>
              <Txt style={styles.accentTxt}>Coupon {appliedCode}</Txt>
              <Txt style={styles.accentTxt}>−₹{finalDiscount}</Txt>
            </View>
          )}
          {walletBalance > 0 && (
            <View style={styles.creditRow}>
              <Checkbox checked={useCredit} onChange={setUseCredit} label={
                <Txt style={styles.creditLabel}>
                  Use ₹{Math.min(walletBalance, Math.max(0, subtotal + finalFee + finalGst - finalDiscount))} Prebooze credit (balance ₹{walletBalance})
                </Txt>
              } />
            </View>
          )}
          {finalCredit > 0 && (
            <View style={styles.kvRow}>
              <Txt style={styles.accentTxt}>Wallet credit</Txt>
              <Txt style={styles.accentTxt}>−₹{finalCredit}</Txt>
            </View>
          )}

          <View style={styles.totalRow}>
            <Txt style={styles.totalLabel}>Total</Txt>
            <Txt style={styles.totalValue}>{quotePending ? 'Calculating…' : `₹${finalTotal}`}</Txt>
          </View>

          <Button
            label={paying ? 'Processing…' : quotePending ? 'Calculating…' : finalTotal === 0 ? 'Confirm booking' : `Pay ₹${finalTotal}`}
            loading={paying}
            disabled={paying || quoting || quotePending}
            onPress={pay}
            style={styles.payBtn}
          />
          <View style={styles.trustRow}>
            <Lock size={11} color={colors.muted} />
            {subtotal > 0 ? <Muted style={styles.trustTxt}>secured by PhonePe · </Muted> : null}
            {/* WebBrowser forces a real browser tab — a plain Linking.openURL
                to prebooze.com now resolves back into this same app since
                it's a verified App Links handler, and silently no-ops on an
                unmapped path like this one. */}
            <Pressable onPress={() => WebBrowser.openBrowserAsync(absoluteUrl('/legal/refund-policy'))}>
              <Txt style={styles.trustLink}>cancel any time before the event</Txt>
            </Pressable>
          </View>
          {!!info?.socials.whatsapp && (
            <Pressable onPress={() => Linking.openURL(waLink(info.socials.whatsapp))}>
              <Txt style={styles.helpLink}>Need help? WhatsApp us</Txt>
            </Pressable>
          )}
        </View>
      </KeyboardAwareScrollView>
    </Screen>
  );
}

function waLink(raw: string): string {
  return /^https?:\/\//i.test(raw.trim()) ? raw.trim() : `https://${raw.trim()}`;
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
}
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
}

/** Polls the real order status (never trusts the browser's own return
 * signal). A human completing UPI/card auth inside the in-app browser (app
 * switch, PIN entry, bank 3DS, etc.) routinely takes well over 30s, so the
 * budget here has to comfortably outlast that — capped at ~6.5min, just
 * under the 8min hold expiry. A too-short budget was a real bug hit
 * 2026-10-13: the poll gave up and showed an error while PhonePe's own
 * success screen was still sitting there, already paid. */
async function pollPayStatus(holdId: string, maxTries = 260): Promise<'paid' | 'failed' | 'unknown'> {
  for (let i = 0; i < maxTries; i++) {
    const { status } = await bookingsApi.payStatus(holdId).catch(() => ({ status: 'unknown' as const }));
    if (status === 'paid' || status === 'failed') return status;
    await new Promise((r) => setTimeout(r, 1500));
  }
  return 'unknown';
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.s },
  blockedTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.l, textAlign: 'center', marginTop: spacing.s },
  blockedSub: { fontSize: fontSize.s, textAlign: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, paddingHorizontal: spacing.l, paddingTop: spacing.s, borderBottomWidth: 1, borderBottomColor: colors.border, paddingBottom: spacing.m },
  title: { fontSize: fontSize.l, fontFamily: fontFamily.bold },
  content: { padding: spacing.l, paddingBottom: spacing.xxl, gap: spacing.m },
  holdBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.m, backgroundColor: 'rgba(155,225,61,0.08)', borderWidth: 1, borderColor: colors.accent, borderRadius: radius.m, padding: spacing.m },
  holdBannerLow: { backgroundColor: 'rgba(255,92,73,0.08)', borderColor: colors.danger },
  holdBannerTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.s },
  holdBannerSub: { fontSize: fontSize.xs },
  holdTimer: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xl, color: colors.accent, fontVariant: ['tabular-nums'] },
  holdTimerLow: { color: colors.danger },
  sectionCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.l },
  sectionTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.m, marginBottom: spacing.m },
  dashedNotice: { flexDirection: 'row', gap: spacing.s, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.border3, borderRadius: radius.m, padding: spacing.m, marginBottom: spacing.m },
  dashedNoticeDanger: { borderColor: colors.danger },
  dashedNoticeTxt: { fontSize: fontSize.xs, flex: 1, lineHeight: 16 },
  knownGuestRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.m },
  knownGuestInfo: { flex: 1 },
  knownGuestSub: { fontSize: fontSize.xs, marginTop: 2 },
  orgName: { fontFamily: fontFamily.bold, fontSize: fontSize.m },
  editLink: { color: colors.accent, fontFamily: fontFamily.medium, fontSize: fontSize.s },
  fieldLabel: { fontFamily: fontFamily.medium, fontSize: fontSize.s, marginBottom: spacing.s, marginTop: spacing.s },
  fieldLabelHint: { fontSize: fontSize.xs },
  input: {
    backgroundColor: colors.surface2, borderColor: colors.border3, borderWidth: 1, borderRadius: radius.m,
    paddingHorizontal: spacing.l, paddingVertical: spacing.m, color: colors.text, fontFamily: fontFamily.regular, fontSize: fontSize.l, marginBottom: spacing.s,
  },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.s },
  hint: { fontSize: fontSize.xs, lineHeight: 16, marginBottom: spacing.s },
  guestBlock: { marginTop: spacing.m, paddingTop: spacing.m, borderTopWidth: 1, borderTopColor: colors.border },
  attendeeErrRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing.s },
  attendeeErrTxt: { color: colors.danger, fontSize: fontSize.s, flex: 1 },
  couponRow: { flexDirection: 'row', gap: spacing.s, alignItems: 'center' },
  applyBtn: { height: 50, paddingHorizontal: spacing.l },
  couponMsgRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, marginTop: spacing.s, flexWrap: 'wrap' },
  couponMsgTxt: { fontSize: fontSize.s },
  payOptRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, paddingVertical: spacing.s },
  radioOuter: { width: 18, height: 18, borderRadius: 9, borderWidth: 1.5, borderColor: colors.border3, alignItems: 'center', justifyContent: 'center' },
  radioOuterOn: { borderColor: colors.accent },
  radioInner: { width: 9, height: 9, borderRadius: 5, backgroundColor: colors.accent },
  payOptLabel: { fontSize: fontSize.s },
  summaryCard: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.l, padding: spacing.l },
  eventTitle: { fontFamily: fontFamily.bold, fontSize: fontSize.m },
  eventMeta: { fontSize: fontSize.xs, marginBottom: spacing.m },
  kvRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  countdownRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 4 },
  countdownTxt: { color: colors.accent, fontFamily: fontFamily.bold, fontSize: fontSize.xs },
  feeNote: { fontSize: fontSize.xs },
  accentTxt: { color: colors.accent, fontSize: fontSize.s },
  creditRow: { marginVertical: spacing.s },
  creditLabel: { fontSize: fontSize.s, flexShrink: 1 },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingTop: spacing.s, marginTop: spacing.s, borderTopWidth: 1, borderTopColor: colors.border },
  totalLabel: { fontFamily: fontFamily.bold, fontSize: fontSize.m },
  totalValue: { fontFamily: fontFamily.extrabold, fontSize: fontSize.xl, color: colors.accent },
  payBtn: { marginTop: spacing.m },
  refBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.s, borderWidth: 1.5, borderStyle: 'dashed', borderColor: colors.accent, borderRadius: radius.m, padding: spacing.m },
  refBannerTxt: { fontSize: fontSize.xs, flex: 1, lineHeight: 16 },
  refBannerName: { fontFamily: fontFamily.bold, fontSize: fontSize.xs },
  trustRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: spacing.m },
  trustTxt: { fontSize: fontSize.xs },
  trustLink: { fontSize: fontSize.xs, color: colors.accent, fontFamily: fontFamily.medium },
  helpLink: { fontSize: fontSize.xs, color: colors.accent, fontFamily: fontFamily.medium, textAlign: 'center', marginTop: spacing.s },
});
