import { useEffect, useState, type ComponentType } from 'react';
import { Briefcase, Landmark, Check, Download, Radar } from 'lucide-react';
import { Kpi } from '../components/ui';
import { liveMarketing, liveInvoices, LiveApiError, type LiveMarketingOrder, type LiveMarketingSubscription, type LiveMarketingRates, type LiveInvoice, type LiveMarketingRealPerformance } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Marketing';
const TYPE_ICON: Record<string, ComponentType<{ size?: number }>> = { organizer: Briefcase, venue: Landmark };
const TypeIcon = ({ type }: { type: string }) => {
  const Icon = TYPE_ICON[type];
  return Icon ? <Icon size={14} /> : null;
};
const SUB_STATUS_LABEL: Record<string, string> = {
  created: 'awaiting authorization', authenticated: 'awaiting authorization', active: 'active',
  pending: 'payment retrying', halted: 'halted — payment failed', cancelled: 'cancelled', completed: 'completed', expired: 'expired',
};

const RATE_FIELDS: { key: keyof LiveMarketingRates; label: string }[] = [
  { key: 'perEvent', label: 'Per event (one-off)' },
  { key: 'monthly', label: 'Subscription / 30 days' },
  { key: 'marginPct', label: 'Prebooze margin %' },
];

const fmt = (n: number) => n.toLocaleString('en-IN');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Organizer/venue-paid Meta ad marketing — review queue + the Meta-campaign
 * handoff (GET/PATCH /admin/marketing/...). This system never talks to
 * Meta's API itself: a paid order sits "pending" until a human on the
 * marketing team has actually created the real campaign and typed its id
 * in here, which is what flips it to "active" and is what unlocks the
 * organizer/venue's own Analytics screen for that event/period. Rates and
 * subscriptions mirror Featured.tsx's own layout — same product shape,
 * different underlying thing being sold. */
export default function Marketing() {
  const session = useLiveSession();
  const { token } = session;

  const [rows, setRows] = useState<LiveMarketingOrder[]>([]);
  const [subs, setSubs] = useState<LiveMarketingSubscription[]>([]);
  const [rates, setRates] = useState<LiveMarketingRates | null>(null);
  const [invoices, setInvoices] = useState<LiveInvoice[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [savingRates, setSavingRates] = useState(false);
  const [campaignDraft, setCampaignDraft] = useState<Record<string, string>>({});
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [realPerf, setRealPerf] = useState<Record<string, LiveMarketingRealPerformance | 'loading' | 'error'>>({});

  const load = () => {
    setLoading(true);
    setErr('');
    // Subscriptions were disabled with the Razorpay removal (2026-09-21) —
    // that endpoint 404s now, and this used to sit inside the same
    // Promise.all() as orders()/rates(), so the one dead call failed the
    // entire load and hid every real, paid marketing order from admin.
    setSubs([]);
    Promise.all([liveMarketing.orders(), liveMarketing.rates(), liveInvoices.list({ type: 'marketing' })])
      .then(([r, ra, inv]) => {
        setRows(r);
        setRates(ra);
        setInvoices(inv);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  const downloadInvoice = async (inv: LiveInvoice) => {
    setDownloadingId(inv.id);
    try {
      await liveInvoices.downloadPdf(inv.id, `${inv.number}.pdf`);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to download invoice');
    } finally {
      setDownloadingId(null);
    }
  };

  const checkRealPerformance = async (id: string) => {
    setRealPerf((p) => ({ ...p, [id]: 'loading' }));
    try {
      const data = await liveMarketing.realPerformance(id);
      setRealPerf((p) => ({ ...p, [id]: data }));
    } catch {
      setRealPerf((p) => ({ ...p, [id]: 'error' }));
    }
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const pending = rows.filter((r) => r.status === 'pending');
  const active = rows.filter((r) => r.status === 'active');
  const expired = rows.filter((r) => r.status === 'expired');
  // Real Razorpay Subscriptions recurring billing was fully removed
  // 2026-09-21 (see prebooze_razorpay_complete_removal memory) — every
  // remaining order is a one-time purchase, so there's no split left to
  // make; all active revenue is per-event now.
  const activeRevenue = active.reduce((a, r) => a + r.amount, 0);
  // The actual, real Prebooze profit — everything else in `amount` is
  // pass-through ad spend meant to fund the Meta campaign, never ours. Only
  // counted for paid orders (paymentId set), same as what actually posts to
  // the income ledger in MarketingService.confirmPayment.
  const marginEarned = rows.filter((r) => r.paymentId).reduce((a, r) => a + Math.round((r.amount * r.marginPct) / 100), 0);
  const activeSubs = subs.filter((s) => s.status === 'active');
  const haltedSubs = subs.filter((s) => s.status === 'halted');

  const activateOrder = async (id: string) => {
    const metaCampaignId = campaignDraft[id]?.trim();
    if (!metaCampaignId) {
      setErr('Enter the real Meta campaign id before activating');
      return;
    }
    try {
      await liveMarketing.setCampaign(id, metaCampaignId);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to activate');
    }
  };
  const reject = async (id: string) => {
    try {
      await liveMarketing.reject(id, rejectReason.trim() || undefined);
      setRejectingId(null);
      setRejectReason('');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to reject');
    }
  };
  const updateRate = async (patch: Partial<LiveMarketingRates>) => {
    setSavingRates(true);
    try {
      const updated = await liveMarketing.updateRates(patch);
      setRates(updated);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save rate');
    } finally {
      setSavingRates(false);
    }
  };

  // Full money breakup, admin-only — base rate, GST, what Prebooze actually
  // keeps (margin) vs. what's pass-through ad spend meant to fund the real
  // Meta campaign. Never shown to the organizer/venue themselves (see this
  // page's own closing hint).
  const Breakup = ({ r }: { r: LiveMarketingOrder }) => {
    const margin = Math.round((r.amount * r.marginPct) / 100);
    const adSpend = r.amount - margin;
    const inv = invoices.find((i) => i.refId === r.id);
    const perf = realPerf[r.id];
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11.5 }} className="muted">
          <span>₹{fmt(r.amount)} base{r.gstAmount ? ` + ₹${fmt(r.gstAmount)} GST` : ''} = <span className="bold" style={{ color: 'var(--text)' }}>₹{fmt(r.total ?? r.amount)}</span></span>
          <span>·</span>
          <span>margin (ours) <span className="bold green">₹{fmt(margin)}</span></span>
          <span>·</span>
          <span>ad spend (theirs) ₹{fmt(adSpend)}</span>
          {inv && (
            <button className="btn btn-ghost btn-sm" disabled={downloadingId === inv.id} onClick={() => downloadInvoice(inv)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px' }}>
              <Download size={11} /> {downloadingId === inv.id ? 'Downloading…' : 'Invoice'}
            </button>
          )}
          {r.metaCampaignId && (
            <button className="btn btn-ghost btn-sm" disabled={perf === 'loading'} onClick={() => checkRealPerformance(r.id)} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '2px 6px' }}>
              <Radar size={11} /> {perf === 'loading' ? 'Checking…' : 'Check real spend'}
            </button>
          )}
        </div>
        {perf === 'error' && <div className="tiny" style={{ color: 'var(--red)' }}>Could not fetch real data from Meta — check the campaign id(s).</div>}
        {perf && perf !== 'loading' && perf !== 'error' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', fontSize: 11.5 }} className="muted">
            <span>real spend <span className="bold" style={{ color: perf.spend > perf.assumedAdSpend ? 'var(--red)' : 'var(--text)' }}>₹{fmt(perf.spend)}</span> <span className="tiny">(assumed ₹{fmt(perf.assumedAdSpend)})</span></span>
            <span>·</span>
            <span>{fmt(perf.impressions)} impressions</span>
            <span>·</span>
            <span>{fmt(perf.reach)} reach</span>
            <span>·</span>
            <span>{fmt(perf.clicks)} clicks · {perf.ctr}% CTR</span>
          </div>
        )}
      </div>
    );
  };

  const PendingRow = ({ r }: { r: LiveMarketingOrder }) => (
    <div className="trow" style={{ minWidth: 720, background: 'rgba(255,107,94,.06)', flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1.4, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><TypeIcon type={r.ownerType} /> {r.entityName}</span>
        <span style={{ flex: 1.2 }} className="muted">{r.eventTitle ?? '30-day subscription period'}</span>
        <span style={{ flex: 0.9 }} className="muted tiny">{fmtDate(r.createdAt)}</span>
        <span style={{ flex: 1.6, display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
          {!r.paymentId ? (
            <span className="tiny muted">awaiting payment</span>
          ) : rejectingId === r.id ? (
            <>
              <input
                className="input" style={{ padding: '5px 8px', width: 160 }}
                placeholder="reason (optional)"
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                autoFocus
              />
              <button className="btn btn-danger btn-sm" onClick={() => reject(r.id)}>Confirm reject</button>
              <button className="btn btn-ghost btn-sm" onClick={() => { setRejectingId(null); setRejectReason(''); }}>Cancel</button>
            </>
          ) : (
            <>
              <input
                className="input" style={{ padding: '5px 8px', width: 160 }}
                placeholder={r.eventTitle ? 'Meta campaign id' : 'Campaign id(s), comma-separated'}
                title={r.eventTitle ? undefined : 'A 30-day plan can cover several events — comma-separate a campaign id per event, or however the real campaigns were structured'}
                value={campaignDraft[r.id] ?? ''}
                onChange={(e) => setCampaignDraft((d) => ({ ...d, [r.id]: e.target.value }))}
              />
              <button className="btn btn-pri btn-sm" onClick={() => activateOrder(r.id)}>Activate</button>
              <button className="btn btn-danger btn-sm" onClick={() => setRejectingId(r.id)}>Reject</button>
            </>
          )}
        </span>
      </div>
      {r.paymentId && <Breakup r={r} />}
    </div>
  );

  const Row = ({ r }: { r: LiveMarketingOrder }) => (
    <div className="trow" style={{ minWidth: 720, flexDirection: 'column', alignItems: 'stretch', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ flex: 1.4, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><TypeIcon type={r.ownerType} /> {r.entityName}</span>
        <span style={{ flex: 1.2 }} className="muted">{r.eventTitle ?? '30-day subscription period'}</span>
        <span style={{ flex: 0.9 }} className="muted tiny">{fmtDate(r.createdAt)}</span>
        <span style={{ flex: 1.6, display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
          <span className="tiny muted">campaign: {r.metaCampaignId}</span>
          <span className="tag tag-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>live <Check size={11} /></span>
        </span>
      </div>
      <Breakup r={r} />
    </div>
  );

  return (
    <div className="stack fade" style={{ maxWidth: 1100, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div className="page-hd">
        <h1 className="page-title">Marketing</h1>
        {pending.length > 0 && (
          <span className="chip" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontWeight: 700 }}>{pending.length} awaiting campaign setup</span>
        )}
      </div>

      <div className="kpi-grid">
        <Kpi label="Awaiting campaign setup" value={fmt(pending.length)} />
        <Kpi label="Live campaigns" value={fmt(active.length)} />
        <Kpi label="Active revenue" value={`₹${fmt(activeRevenue)}`} delta="gross, incl. ad spend" deltaColor="var(--muted)" />
        <Kpi label="Prebooze margin earned" value={`₹${fmt(marginEarned)}`} delta="real income, all paid orders" deltaColor="var(--green)" />
        <Kpi label="Lapsed" value={fmt(expired.length)} deltaColor="var(--red)" />
      </div>

      <div className="card">
        <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Pricing</div>
        <div className="tiny hint" style={{ marginBottom: 10 }}>what organizers/venues pay us — margin is never shown to them, only to admin{savingRates && ' · saving…'}</div>
        <div className="kpi-grid">
          {RATE_FIELDS.map((r) => (
            <div className="field" key={r.key}>
              <label>{r.label}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="muted">{r.key === 'marginPct' ? '' : '₹'}</span>
                <input
                  className="input"
                  style={{ padding: '6px 8px' }}
                  value={rates ? String(rates[r.key]) : ''}
                  inputMode="numeric"
                  disabled={!rates}
                  onChange={(e) => setRates((prev) => (prev ? { ...prev, [r.key]: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 } : prev))}
                  onBlur={(e) => updateRate({ [r.key]: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 } as Partial<LiveMarketingRates>)}
                />
                {r.key === 'marginPct' && <span className="muted">%</span>}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="tblwrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          <span className="display" style={{ fontWeight: 700 }}>Awaiting campaign setup</span>
          <span className="small muted">{pending.length} pending</span>
        </div>
        {loading ? (
          <div className="trow muted">Loading…</div>
        ) : pending.length === 0 ? (
          <div className="trow muted">Nothing to review — all caught up.</div>
        ) : (
          pending.map((r) => <PendingRow key={r.id} r={r} />)
        )}
      </div>

      <div className="tblwrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          <span className="display" style={{ fontWeight: 700 }}>Live campaigns</span>
          <span className="small muted">{active.length} active</span>
        </div>
        {active.length === 0 ? (
          <div className="trow muted">No live marketing campaigns.</div>
        ) : (
          active.map((r) => <Row key={r.id} r={r} />)
        )}
      </div>

      <div className="tblwrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          <span className="display" style={{ fontWeight: 700 }}>Auto-renewal subscriptions</span>
          <span className="small muted">{activeSubs.length} active{haltedSubs.length > 0 && ` · ${haltedSubs.length} halted`}</span>
        </div>
        <div className="thead" style={{ minWidth: 620 }}>
          <span style={{ flex: 1.6 }}>Owner</span>
          <span style={{ flex: 0.9 }}>Type</span>
          <span style={{ flex: 1 }}>₹/30d</span>
          <span style={{ flex: 0.8 }}>Payments</span>
          <span style={{ flex: 1.2 }}>Status</span>
          <span style={{ flex: 1 }}>Current period ends</span>
        </div>
        {subs.length === 0 ? (
          <div className="trow muted">No auto-renewing subscriptions yet.</div>
        ) : (
          subs.map((s) => (
            <div key={s.id} className="trow" style={{ minWidth: 620, background: s.status === 'halted' ? 'rgba(255,107,94,.06)' : undefined }}>
              <span style={{ flex: 1.6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><TypeIcon type={s.ownerType} /> {s.entityName}</span>
              <span style={{ flex: 0.9 }} className="muted">{s.ownerType}</span>
              <span style={{ flex: 1 }}>₹{fmt(s.amountPerCycle)}</span>
              <span style={{ flex: 0.8 }} className="muted">{s.paidCount}</span>
              <span style={{ flex: 1.2 }} className={s.status === 'active' ? 'green' : s.status === 'halted' ? 'danger-text' : 'muted'}>
                {SUB_STATUS_LABEL[s.status] ?? s.status}
              </span>
              <span style={{ flex: 1 }} className="muted tiny">{s.currentEnd ? fmtDate(s.currentEnd) : '—'}</span>
            </div>
          ))
        )}
      </div>

      <div className="tiny hint">
        activating a paid order requires a real Meta campaign id — create the campaign by hand first (same process as the platform's own city-wide campaigns), then paste its id here · the organizer/venue only ever sees what they paid, never this margin or the real ad spend
      </div>
    </div>
  );
}
