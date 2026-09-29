import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Rocket } from 'lucide-react';
import { organizer } from '../../api';
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
  const [rates, setRates] = useState<MarketingRates | null>(null);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [busyEventId, setBusyEventId] = useState<string | null>(null);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);

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
      // Genuinely never confirmed after 6 tries (~10s) — abandon() re-checks
      // PhonePe's real status one last time server-side (never discards an
      // actually-completed payment) and frees the event up immediately
      // instead of leaving it stuck for 15 minutes.
      try {
        await organizer.marketing.abandon(phonepeReturnOrderId);
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
    // invoices() already returns every real invoice for this organizer
    // (GET /organizer/invoices), marketing ones included — matched to a
    // specific order below by refId, so "Download invoice" here is just a
    // shortcut into data that already existed, not a new endpoint.
    Promise.all([organizer.events(), organizer.marketing.orders(), organizer.marketing.rates(), organizer.invoices()])
      .then(([e, o, r, inv]) => {
        setEvents(e);
        setOrders(o);
        setRates(r);
        setInvoices(inv);
      })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const downloadInvoice = async (inv: Invoice) => {
    setDownloadingId(inv.id);
    try {
      await organizer.downloadInvoicePdf(inv.id, `${inv.number}.pdf`);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  if (resumingPhonePe) return <PageLoader />;
  if (loading) return <div className="stack fade"><p className="muted">Loading…</p></div>;

  const upcoming = events.filter((e) => !isEventOver(e));
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
                      {o.isSubscriptionPeriod ? `30-day period${o.periodStart ? ` · from ${fmtDate(o.periodStart)}` : ''}` : o.eventTitle}
                      {o.status === 'active' && !o.isSubscriptionPeriod && (
                        <> · <Link to={`/organizer/marketing/analytics?eventId=${o.eventId}`} className="link tiny">view analytics</Link></>
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
