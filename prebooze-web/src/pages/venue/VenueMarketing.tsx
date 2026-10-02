import { useEffect, useLayoutEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Rocket, Download, Sparkles, TrendingUp, Eye, Users, MousePointerClick, Percent } from 'lucide-react';
import { venuePartner } from '../../api';
import type { Event as PbEvent, Invoice } from '../../types';
import { ApiError } from '../../api/client';
import { fmtMoney, isEventOver } from '../../data/mock';
import { PageLoader } from '../../components/Loader';
import type { MarketingOrder, MarketingRates } from '../../types';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const STATUS_LABEL: Record<MarketingOrder['status'], string> = {
  pending: 'awaiting campaign setup', active: 'running', rejected: 'declined', expired: 'ended',
};
const STATUS_BADGE: Record<MarketingOrder['status'], string> = {
  pending: 'badge-pending', active: 'badge-ok', rejected: 'badge-danger', expired: 'badge-outline',
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

  // Whichever plan has the lowest cost-per-day is the one worth calling out —
  // computed, never hardcoded, since admin can retune these rates any time.
  const bestValueDays = rates
    ? ([7, 15, 30] as const).reduce((best, d) => (periodRate(d) / d < periodRate(best) / best ? d : best), 7 as 7 | 15 | 30)
    : null;

  return (
    <div className="stack fade" style={{ maxWidth: 840, gap: 36 }}>
      <div className="page-hd">
        <h1 className="page-title" style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ display: 'inline-flex', width: 36, height: 36, borderRadius: 10, background: 'rgba(155,225,61,.12)', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Rocket size={18} style={{ color: 'var(--accent)' }} />
          </span>
          Marketing
        </h1>
      </div>
      <p className="muted small" style={{ maxWidth: 560, marginTop: 8 }}>
        Prebooze runs a dedicated Meta ad campaign for your event(s) — pay per event, or pick a plan that covers
        everything you run over a set window. Once a campaign is live, real performance numbers show up on that
        event's Analytics tab.
      </p>
      {err && <div className="card" style={{ borderColor: 'var(--danger)', color: 'var(--danger)' }}>{err}</div>}

      {/* Pay per event */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <TrendingUp size={16} className="muted" />
          <h3 style={{ margin: 0 }}>Run ads for one event</h3>
        </div>
        <p className="muted small" style={{ marginTop: 4 }}>A one-time fee runs a dedicated campaign for a single upcoming event.</p>
        {eligibleEvents.length === 0 ? (
          <p className="muted small" style={{ marginTop: 10 }}>No eligible upcoming events — an event already has a marketing order or a plan covering it once you buy for it.</p>
        ) : (
          <div style={{ marginTop: 6 }}>
            {eligibleEvents.map((e) => (
              <div key={e.id} className="evrow">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bold small" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                  <div className="tiny muted" style={{ marginTop: 2 }}>{fmtDate(e.date)}</div>
                </div>
                <button className="btn btn-pri btn-sm" disabled={busyEventId === e.id || !rates} onClick={() => buyForEvent(e.id)}>
                  {busyEventId === e.id ? 'Opening payment…' : `${rates ? fmtMoney(rates.perEvent + Math.round((rates.perEvent * rates.gstPct) / 100)) : ''} →`}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <Sparkles size={16} className="muted" />
          <h3 style={{ margin: 0 }}>Or cover every event with a plan</h3>
        </div>
        <p className="muted small" style={{ marginTop: 4, marginBottom: 14 }}>
          One payment runs a campaign across everything you run in that window. It's a one-time purchase, not an
          auto-renewing subscription — buying the next plan is separate once this one ends.
        </p>
        {hasPeriodOrder ? (
          <p className="muted small">You already have a plan in progress or active — see it in Billing history below.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 18 }}>
            {([7, 15, 30] as const).map((days) => {
              const rate = periodRate(days);
              const total = rate + Math.round((rate * (rates?.gstPct ?? 0)) / 100);
              const perDay = Math.round(rate / days);
              const isBest = days === bestValueDays;
              return (
                <div
                  key={days}
                  style={{
                    position: 'relative', display: 'flex', flexDirection: 'column', gap: 8, padding: '16px 14px',
                    borderRadius: 12, border: `1.5px solid ${isBest ? 'var(--accent)' : 'var(--border)'}`,
                    background: isBest ? 'rgba(155,225,61,.06)' : 'var(--surface-2)',
                  }}
                >
                  {isBest && (
                    <span className="tiny bold" style={{ position: 'absolute', top: -10, left: 12, background: 'var(--accent)', color: 'var(--on-accent)', padding: '2px 8px', borderRadius: 999 }}>
                      Best value
                    </span>
                  )}
                  <div className="muted small" style={{ marginTop: isBest ? 4 : 0 }}>{days}-day plan</div>
                  <div style={{ fontSize: 22, fontWeight: 700 }}>{rates ? fmtMoney(total) : '—'}</div>
                  <div className="tiny muted">{rates ? `≈ ${fmtMoney(perDay)} / day` : ''}</div>
                  <button
                    className={isBest ? 'btn btn-pri btn-sm' : 'btn btn-ghost btn-sm'}
                    style={{ marginTop: 4 }}
                    disabled={buyingPeriod !== null || !rates}
                    onClick={() => buyForPeriod(days)}
                  >
                    {buyingPeriod === days ? 'Opening…' : 'Run ads →'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Billing history */}
      <div className="card">
        <h3>Billing history</h3>
        {orders.length === 0 ? (
          <p className="muted small" style={{ marginTop: 8 }}>No marketing payments yet.</p>
        ) : (
          <div className="stack" style={{ gap: 12, marginTop: 10 }}>
            {orders.map((o) => {
              const inv = invoices.find((i) => i.type === 'marketing' && i.refId === o.id);
              const label = o.isSubscriptionPeriod
                ? `${o.periodStart && o.periodEnd ? Math.round((new Date(o.periodEnd).getTime() - new Date(o.periodStart).getTime()) / 86400000) : 30}-day plan`
                : o.eventTitle;
              return (
                <div key={o.id} style={{ borderRadius: 10, border: '1px solid var(--border)', padding: '12px 14px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 10, flexWrap: 'wrap' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="bold small">
                        {label}
                        {o.isSubscriptionPeriod && o.periodStart && <span className="tiny muted"> · from {fmtDate(o.periodStart)}</span>}
                      </div>
                      {o.status === 'active' && (
                        <Link to={o.isSubscriptionPeriod ? `/venue/hosting/marketing/analytics?orderId=${o.id}` : `/venue/hosting/marketing/analytics?eventId=${o.eventId}`} className="link tiny">
                          view analytics →
                        </Link>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span className={`badge ${STATUS_BADGE[o.status]}`}>{STATUS_LABEL[o.status]}</span>
                      <span className="tiny muted">{fmtDate(o.createdAt)}</span>
                    </div>
                  </div>
                  {o.status === 'rejected' && o.rejectionReason && (
                    <p className="tiny danger-text" style={{ margin: '8px 0 0', background: 'rgba(255,92,73,.08)', border: '1px solid rgba(255,92,73,.2)', borderRadius: 8, padding: '6px 10px' }}>
                      {o.rejectionReason}
                    </p>
                  )}
                  {o.status === 'pending' && (
                    <p className="tiny muted" style={{ margin: '8px 0 0' }}>
                      Payment received — our team is setting up the real Meta ad campaign now. This usually takes a few hours; you'll see it switch to "running" here once it's live.
                    </p>
                  )}
                  {o.status === 'active' && o.adPerformance && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5 }} className="muted">
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Eye size={13} /> {o.adPerformance.impressions.toLocaleString('en-IN')} impressions</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Users size={13} /> {o.adPerformance.reach.toLocaleString('en-IN')} reach</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><MousePointerClick size={13} /> {o.adPerformance.clicks.toLocaleString('en-IN')} clicks</span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Percent size={13} /> {o.adPerformance.ctr}% CTR</span>
                    </div>
                  )}
                  {o.status === 'active' && o.metaCampaignId && (
                    <div className="tiny muted" style={{ marginTop: 4 }}>Campaign ID: {o.metaCampaignId}</div>
                  )}
                  {/* Full breakup, not just the total — base rate + GST separately,
                      so it's clear exactly what was charged and why. */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 8, paddingTop: 8, borderTop: '1px dashed var(--border-dash)' }}>
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
