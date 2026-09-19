import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { organizer } from '../../api';
import type { Event as PbEvent } from '../../types';
import { ApiError } from '../../api/client';
import { fmtMoney } from '../../data/mock';
import { PageLoader } from '../../components/Loader';
import type { MarketingOrder, MarketingSubscription, MarketingRates } from '../../types';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const POLL_MS = 3000;

const STATUS_LABEL: Record<MarketingOrder['status'], string> = {
  pending: 'awaiting campaign setup', active: 'running', rejected: 'declined', expired: 'ended',
};

/** Organizer-side of the paid Meta ad marketing product — pay per event, or
 * a rolling 30-day subscription covering every event. Deliberately shows
 * only what was PAID, never the real ad spend or Prebooze's margin (see
 * MarketingService's own doc comment) — for actual performance numbers,
 * see MarketingAnalytics.tsx, which only unlocks per event once it has an
 * active/completed order here. One-time purchases redirect to PhonePe's
 * real hosted checkout (same pattern as guest ticket payments — see
 * Checkout.tsx); the subscription reuses the hosted-shortUrl + poll pattern
 * PromoteCard already established for Featured placements (still Razorpay,
 * unmigrated — see the payment-gateway migration plan). */
export default function Marketing() {
  const [searchParams] = useSearchParams();
  const [events, setEvents] = useState<PbEvent[]>([]);
  const [orders, setOrders] = useState<MarketingOrder[]>([]);
  const [sub, setSub] = useState<MarketingSubscription | null>(null);
  const [rates, setRates] = useState<MarketingRates | null>(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [subBusy, setSubBusy] = useState(false);
  const [awaitingAuth, setAwaitingAuth] = useState<{ shortUrl: string } | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // ---- resuming after a PhonePe redirect (real full-page checkout, not an
  // embedded widget — see Checkout.tsx, the original of this pattern) ----
  // No attendee-details-style payload to stash here — confirmPayment takes
  // no client-supplied proof at all, PhonePe's own getOrderStatus is the
  // sole source of truth server-side, so the orderId in the return URL is
  // all the resume handler needs.
  const phonepeReturnOrderId = searchParams.get('phonepe_return') === '1' ? searchParams.get('orderId') : null;
  const [resumingPhonePe, setResumingPhonePe] = useState(Boolean(phonepeReturnOrderId));
  // Reactive resync, not just a one-time initializer — a bfcache-restored
  // instance or a router-hydration-timing gap can otherwise leave this
  // stuck false while the URL already reflects a real return. Real bug
  // found and fixed this exact way in Checkout.tsx (2026-09-19); applying
  // it here from the start rather than rediscovering it.
  useLayoutEffect(() => {
    if (phonepeReturnOrderId) setResumingPhonePe(true);
  }, [phonepeReturnOrderId]);
  useEffect(() => {
    if (!phonepeReturnOrderId) return;
    let cancelled = false;
    (async () => {
      for (let attempt = 0; attempt < 6; attempt++) {
        if (attempt > 0) await new Promise((r) => setTimeout(r, 2000));
        try {
          await organizer.marketing.confirmPayment(phonepeReturnOrderId);
          if (cancelled) return;
          setResumingPhonePe(false);
          load();
          return;
        } catch {
          // could be a genuinely still-PENDING order — retry a few times
          // before giving up, same reasoning as Checkout.tsx's resume loop.
        }
      }
      if (cancelled) return;
      setResumingPhonePe(false);
      setErr(`If your payment went through, check back in a minute — if it's still not showing, contact support with reference ${phonepeReturnOrderId}.`);
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phonepeReturnOrderId]);

  const load = () => {
    setErr('');
    Promise.all([organizer.events(), organizer.marketing.orders(), organizer.marketing.mySubscription(), organizer.marketing.rates()])
      .then(([e, o, s, r]) => {
        setEvents(e);
        setOrders(o);
        setSub(s);
        setRates(r);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);
  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  if (resumingPhonePe) return <PageLoader />;
  if (loading) return <div className="stack fade"><p className="muted">Loading…</p></div>;

  const now = Date.now();
  const upcoming = events.filter((e) => new Date(e.date).getTime() + e.durationHrs * 3600_000 > now);
  const eventsWithOrder = new Set(orders.filter((o) => o.status === 'pending' || o.status === 'active').map((o) => o.eventId));
  const eligibleEvents = upcoming.filter((e) => !eventsWithOrder.has(e.id));

  const buyForEvent = async (eventId: string) => {
    setErr('');
    setBusyEventId(eventId);
    try {
      const { phonepeRedirectUrl } = await organizer.marketing.request(eventId);
      window.location.href = phonepeRedirectUrl;
      // this component instance is about to be torn down by the navigation
    } catch (e) {
      setBusyEventId(null);
      setErr(e instanceof ApiError ? e.message : 'Could not start payment — try again');
    }
  };

  const startPolling = (shortUrl: string) => {
    setAwaitingAuth({ shortUrl });
    if (pollRef.current) clearInterval(pollRef.current);
    pollRef.current = setInterval(async () => {
      try {
        const s = await organizer.marketing.mySubscription();
        setSub(s);
        if (s && s.status !== 'created' && s.status !== 'authenticated') {
          clearInterval(pollRef.current!);
          pollRef.current = null;
          setAwaitingAuth(null);
          setSubBusy(false);
          load();
        }
      } catch {
        // transient — keep polling
      }
    }, POLL_MS);
  };

  const subscribe = async () => {
    setErr('');
    setSubBusy(true);
    try {
      const res = await organizer.marketing.subscribe();
      if (res.requiresAuthorization && res.shortUrl) {
        window.open(res.shortUrl, '_blank', 'noopener');
        startPolling(res.shortUrl);
      } else {
        setSubBusy(false);
        load();
      }
    } catch (e) {
      setSubBusy(false);
      setErr(e instanceof ApiError ? e.message : 'Could not start subscription — try again');
    }
  };

  const cancelSub = async () => {
    if (!window.confirm('Stop auto-renewing your marketing subscription? Campaigns already running stay active until the current 30-day period ends.')) return;
    setSubBusy(true);
    try {
      await organizer.marketing.cancelSubscription();
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Could not cancel — try again');
    } finally {
      setSubBusy(false);
    }
  };

  const subActive = sub?.status === 'active';
  const subHalted = sub?.status === 'halted';
  const subPending = sub?.status === 'created' || sub?.status === 'authenticated' || sub?.status === 'pending';

  return (
    <div className="stack fade" style={{ maxWidth: 760, gap: 16 }}>
      <div className="page-hd">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>Marketing <Rocket size={20} /></h1>
      </div>
      <p className="muted small" style={{ marginTop: -8 }}>
        Prebooze runs a dedicated ad campaign for your event(s). Pay per event, or subscribe for a rolling 30-day
        window covering everything you run. For real performance numbers once a campaign is live, see the Analytics
        tab on that event.
      </p>
      {err && <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err}</div>}

      {/* Subscription */}
      <div className="card" style={{ borderColor: subActive ? 'var(--accent)' : undefined }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <h3>30-day marketing subscription</h3>
            <p className="muted small" style={{ marginTop: 4, maxWidth: 440 }}>
              Covers every event you run during each 30-day billing period. Renews automatically.
            </p>
          </div>
          {subActive ? (
            <span className="badge badge-accent">Active · renews {sub!.currentEnd ? fmtDate(sub!.currentEnd) : ''}</span>
          ) : subPending ? (
            <button className="btn btn-pri" disabled={subBusy} onClick={subscribe}>
              {subBusy ? 'Opening payment…' : 'Complete authorization →'}
            </button>
          ) : (
            <button className="btn btn-pri" disabled={subBusy || !rates} onClick={subscribe}>
              {subBusy ? 'Opening payment…' : `Subscribe for ${rates ? fmtMoney(rates.monthly) : ''}/30 days →`}
            </button>
          )}
        </div>
        {subActive && (
          <div className="tiny muted-2" style={{ marginTop: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
            <span>{sub!.paidCount} payment{sub!.paidCount === 1 ? '' : 's'} so far</span>
            <button className="btn btn-ghost btn-sm" disabled={subBusy} onClick={cancelSub}>Cancel auto-renew</button>
          </div>
        )}
        {subHalted && (
          <div className="card" style={{ marginTop: 12, borderColor: 'var(--danger)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <div className="tiny danger-text">Auto-renewal payment failed — your subscription has paused.</div>
            <button className="btn btn-pri btn-sm" disabled={subBusy} onClick={subscribe}>
              {subBusy ? 'Opening payment…' : 'Resubscribe →'}
            </button>
          </div>
        )}
        {awaitingAuth && (
          <div className="card" style={{ marginTop: 12, background: 'var(--surface-2)' }}>
            <p className="muted small" style={{ margin: 0 }}>
              Complete the authorization in the tab that just opened — this updates automatically.{' '}
              <a href={awaitingAuth.shortUrl} target="_blank" rel="noopener noreferrer" className="link">Reopen the payment page</a>
            </p>
          </div>
        )}
      </div>

      {/* Pay per event */}
      <div className="card">
        <h3>Pay for one event</h3>
        <p className="muted small" style={{ marginTop: 4 }}>A one-time fee runs a dedicated campaign for a single upcoming event.</p>
        {eligibleEvents.length === 0 ? (
          <p className="muted small" style={{ marginTop: 10 }}>No eligible upcoming events — an event already has a marketing order in progress once you buy for it.</p>
        ) : (
          <div className="stack" style={{ gap: 8, marginTop: 10 }}>
            {eligibleEvents.map((e) => (
              <div key={e.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>{e.title} <span className="tiny muted">· {fmtDate(e.date)}</span></span>
                <button className="btn btn-pri btn-sm" disabled={busyEventId === e.id || !rates} onClick={() => buyForEvent(e.id)}>
                  {busyEventId === e.id ? 'Opening payment…' : `Run ads for ${rates ? fmtMoney(rates.perEvent) : ''} →`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Billing history */}
      <div className="card">
        <h3>Billing history</h3>
        {orders.length === 0 ? (
          <p className="muted small" style={{ marginTop: 8 }}>No marketing payments yet.</p>
        ) : (
          <div className="stack" style={{ gap: 6, marginTop: 8 }}>
            {orders.map((o) => (
              <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 13.5 }}>
                <span>
                  {o.isSubscriptionPeriod ? `30-day period${o.periodStart ? ` · from ${fmtDate(o.periodStart)}` : ''}` : o.eventTitle}
                  {o.status === 'active' && !o.isSubscriptionPeriod && (
                    <> · <Link to={`/organizer/marketing/analytics?eventId=${o.eventId}`} className="link tiny">view analytics</Link></>
                  )}
                </span>
                <span className="muted">{fmtMoney(o.amount)} · {STATUS_LABEL[o.status]} · {fmtDate(o.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
