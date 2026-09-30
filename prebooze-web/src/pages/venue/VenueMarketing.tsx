import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { venuePartner } from '../../api';
import type { Event as PbEvent, Invoice } from '../../types';
import { ApiError } from '../../api/client';
import { fmtMoney, isEventOver } from '../../data/mock';
import { PageLoader } from '../../components/Loader';
import { Download } from 'lucide-react';
import type { MarketingOrder, MarketingRates } from '../../types';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_LABEL: Record<MarketingOrder['status'], string> = {
  pending: 'awaiting campaign setup', active: 'running', rejected: 'declined', expired: 'ended',
};

/** Venue-side of the paid Meta ad marketing product — pay per event, or
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
  const [rates, setRates] = useState<MarketingRates | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [buyingPeriod, setBuyingPeriod] = useState<7 | 15 | 30 | null>(null);

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
          await venuePartner.marketing.confirmPayment(phonepeReturnOrderId);
          if (cancelled) return;
          setResumingPhonePe(false);
          load();
          return;
        } catch {
          // could be a genuinely still-PENDING order — retry a few times
          // before giving up, same reasoning as Checkout.tsx's resume loop.
        }
      }
      // Genuinely never confirmed after 6 tries (~10s) — abandon() re-checks
      // PhonePe's real status one last time server-side (never discards an
      // actually-completed payment) and frees the event up immediately
      // instead of leaving it stuck for 15 minutes.
      try {
        await venuePartner.marketing.abandon(phonepeReturnOrderId);
      } catch {
        // best-effort — worst case it just waits out the normal staleness window
      }
      if (cancelled) return;
      setResumingPhonePe(false);
      setErr('Payment was not completed — you can try again.');
      load();
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phonepeReturnOrderId]);

  const load = () => {
    setErr('');
    Promise.all([venuePartner.hostedEvents(), venuePartner.marketing.orders(), venuePartner.marketing.rates(), venuePartner.invoices()])
      .then(([e, o, r, inv]) => {
        setEvents(e);
        setOrders(o);
        setRates(r);
        setInvoices(inv);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  const downloadInvoice = async (inv: Invoice) => {
    setDownloadingId(inv.id);
    try {
      await venuePartner.downloadInvoicePdf(inv.id, `${inv.number}.pdf`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  };
  useEffect(load, []);

  if (resumingPhonePe) return <PageLoader />;
  if (loading) return <div className="stack fade"><p className="muted">Loading…</p></div>;

  const upcoming = events.filter((e) => !isEventOver(e));
  const eventsWithOrder = new Set(orders.filter((o) => o.status === 'pending' || o.status === 'active').map((o) => o.eventId));
  // An active 30-day plan already covers every event running in its window —
  // buying a per-event campaign on top would just be paying twice for the
  // same coverage.
  const activePeriods = orders.filter((o) => o.isSubscriptionPeriod && o.status === 'active');
  const coveredByPeriod = (date: string) => activePeriods.some((o) => o.periodStart && o.periodEnd && date >= o.periodStart && date <= o.periodEnd);
  const eligibleEvents = upcoming.filter((e) => !eventsWithOrder.has(e.id) && !coveredByPeriod(e.date));

  const buyForEvent = async (eventId: string) => {
    setErr('');
    setBusyEventId(eventId);
    try {
      const { phonepeRedirectUrl } = await venuePartner.marketing.request(eventId);
      window.location.href = phonepeRedirectUrl;
      // this component instance is about to be torn down by the navigation
    } catch (e) {
      setBusyEventId(null);
      setErr(e instanceof ApiError ? e.message : 'Could not start payment — try again');
    }
  };

  const hasPeriodOrder = orders.some((o) => o.isSubscriptionPeriod && (o.status === 'pending' || o.status === 'active'));
  const buyForPeriod = async (days: 7 | 15 | 30) => {
    setErr('');
    setBuyingPeriod(days);
    try {
      const { phonepeRedirectUrl } = await venuePartner.marketing.requestPeriod(days);
      window.location.href = phonepeRedirectUrl;
    } catch (e) {
      setBuyingPeriod(null);
      setErr(e instanceof ApiError ? e.message : 'Could not start payment — try again');
    }
  };
  const periodRate = (days: 7 | 15 | 30) => (rates ? (days === 7 ? rates.day7 : days === 15 ? rates.day15 : rates.monthly) : 0);

  return (
    <div className="stack fade" style={{ maxWidth: 760, gap: 16 }}>
      <div className="page-hd">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 14 }}>Marketing <Rocket size={20} style={{ flexShrink: 0 }} /></h1>
      </div>
      <p className="muted small">
        Prebooze runs a dedicated ad campaign for your event(s). Pay per event, or subscribe for a rolling 30-day
        window covering everything you run. For real performance numbers once a campaign is live, see the Analytics
        tab on that event.
      </p>
      {err && <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err}</div>}


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
                  {busyEventId === e.id ? 'Opening payment…' : `Run ads for ${rates ? fmtMoney(rates.perEvent + Math.round((rates.perEvent * rates.gstPct) / 100)) : ''} →`}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Pay for a plan — a one-time purchase, no auto-renewal (real
          PhonePe AutoPay support doesn't exist yet); covers every event run
          in the chosen window, then just stops. */}
      <div className="card">
        <h3>Pay for a plan — all events</h3>
        <p className="muted small" style={{ marginTop: 4 }}>
          One payment runs a dedicated campaign covering every event you run over the plan's window. It's a one-time
          purchase, not an auto-renewing subscription — buying the next plan is a separate purchase once this one ends.
        </p>
        {hasPeriodOrder ? (
          <p className="muted small" style={{ marginTop: 10 }}>You already have a plan in progress or active.</p>
        ) : (
          <div className="stack" style={{ gap: 8, marginTop: 10 }}>
            {([7, 15, 30] as const).map((days) => (
              <div key={days} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <span>{days}-day plan</span>
                <button className="btn btn-pri btn-sm" disabled={buyingPeriod !== null || !rates} onClick={() => buyForPeriod(days)}>
                  {buyingPeriod === days ? 'Opening payment…' : `Run ads for ${rates ? fmtMoney(periodRate(days) + Math.round((periodRate(days) * rates.gstPct) / 100)) : ''} →`}
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
          <div className="stack" style={{ gap: 10, marginTop: 8 }}>
            {orders.map((o) => {
              const inv = invoices.find((i) => i.type === 'marketing' && i.refId === o.id);
              return (
                <div key={o.id} style={{ display: 'flex', flexDirection: 'column', gap: 2, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap' }}>
                    <span>
                      {o.isSubscriptionPeriod
                        ? `${o.periodStart && o.periodEnd ? Math.round((new Date(o.periodEnd).getTime() - new Date(o.periodStart).getTime()) / 86400000) : 30}-day plan${o.periodStart ? ` · from ${fmtDate(o.periodStart)}` : ''}`
                        : o.eventTitle}
                      {o.status === 'active' && (
                        <> · <Link to={o.isSubscriptionPeriod ? `/venue/hosting/marketing/analytics?orderId=${o.id}` : `/venue/hosting/marketing/analytics?eventId=${o.eventId}`} className="link tiny">view analytics</Link></>
                      )}
                    </span>
                    <span className="muted small">{STATUS_LABEL[o.status]} · {fmtDate(o.createdAt)}</span>
                  </div>
                  {o.status === 'rejected' && o.rejectionReason && (
                    <p className="tiny danger-text" style={{ margin: '2px 0 0' }}>{o.rejectionReason}</p>
                  )}
                  {/* Full breakup, not just the total — base rate + GST separately,
                      so it's clear exactly what was charged and why. */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span className="tiny muted">
                      {fmtMoney(o.amount)} campaign fee{o.gstAmount > 0 ? ` + ${fmtMoney(o.gstAmount)} GST` : ''} = <span className="bold" style={{ color: 'var(--text)' }}>{fmtMoney(o.total)}</span>
                    </span>
                    {inv && (
                      <button className="btn btn-ghost btn-sm" disabled={downloadingId === inv.id} onClick={() => downloadInvoice(inv)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                        <Download size={12} /> {downloadingId === inv.id ? 'Downloading…' : 'Invoice'}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
