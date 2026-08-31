import { useEffect, useState, type ComponentType } from 'react';
import { Ticket, Mic2, Landmark, Megaphone, Headphones, RotateCcw, Check } from 'lucide-react';
import { Kpi } from '../components/ui';
import { liveFeatured, LiveApiError, type LiveFeatured, type LiveFeaturedRates, type LiveFeaturedSubscription } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Featured';
const TYPE_ICON: Record<string, ComponentType<{ size?: number }>> = { event: Ticket, organizer: Mic2, promoter: Megaphone, lineup: Headphones, venue: Landmark };
const TypeIcon = ({ type }: { type: string }) => {
  const Icon = TYPE_ICON[type];
  return Icon ? <Icon size={14} /> : null;
};
const SUB_STATUS_LABEL: Record<string, string> = {
  created: 'awaiting authorization', authenticated: 'awaiting authorization', active: 'active',
  pending: 'payment retrying', halted: 'halted — payment failed', cancelled: 'cancelled', completed: 'completed', expired: 'expired',
};

const RATE_FIELDS: { key: keyof LiveFeaturedRates; label: string }[] = [
  { key: 'perEvent', label: 'Per event (one-off)' },
  { key: 'organizerMonthly', label: 'Organizer / month' },
  { key: 'promoterMonthly', label: 'Promoter / month' },
  { key: 'lineupMonthly', label: 'Line-up / month' },
  { key: 'venueMonthly', label: 'Venue / month' },
];

const fmt = (n: number) => n.toLocaleString('en-IN');
const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Real Featured placement review queue + rates + auto-renewal visibility —
 * GET/POST /admin/featured(...), GET/PATCH /admin/featured/rates,
 * GET /admin/featured/subscriptions. Was entirely mock (usePersisted local
 * state, approve/reject buttons that never touched the backend) until this
 * rewrite — the real AdminFeaturedController this now talks to already
 * existed and worked, nothing in the admin panel could actually reach it. */
export default function Featured() {
  const session = useLiveSession();
  const { token } = session;

  const [rows, setRows] = useState<LiveFeatured[]>([]);
  const [subs, setSubs] = useState<LiveFeaturedSubscription[]>([]);
  const [rates, setRates] = useState<LiveFeaturedRates | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [savingRates, setSavingRates] = useState(false);

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveFeatured.list(), liveFeatured.subscriptions(), liveFeatured.rates()])
      .then(([r, s, ra]) => {
        setRows(r);
        setSubs(s);
        setRates(ra);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const pending = rows.filter((f) => f.status === 'pending');
  const active = rows.filter((f) => f.status === 'active');
  const expired = rows.filter((f) => f.status === 'expired');
  const monthlyRecurring = active.filter((f) => f.billing === 'monthly').reduce((a, f) => a + f.amount, 0);
  const perEventRevenue = active.filter((f) => f.billing === 'per_event').reduce((a, f) => a + f.amount, 0);
  const activeSubs = subs.filter((s) => s.status === 'active');
  const haltedSubs = subs.filter((s) => s.status === 'halted');

  const approve = async (id: string) => {
    try {
      await liveFeatured.approve(id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to approve');
    }
  };
  const reject = async (id: string) => {
    try {
      await liveFeatured.reject(id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to reject');
    }
  };
  const remind = async (id: string) => {
    try {
      await liveFeatured.remind(id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to send reminder');
    }
  };
  const updateRate = async (patch: Partial<LiveFeaturedRates>) => {
    setSavingRates(true);
    try {
      const updated = await liveFeatured.updateRates(patch);
      setRates(updated);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save rate');
    } finally {
      setSavingRates(false);
    }
  };

  const Row = ({ f, actions }: { f: LiveFeatured; actions?: boolean }) => (
    <div className="trow" style={{ minWidth: 640, background: f.status === 'pending' ? 'rgba(255,107,94,.06)' : undefined }}>
      <span style={{ flex: 1.6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><TypeIcon type={f.type} /> {f.entityName}</span>
      <span style={{ flex: 0.9 }} className="muted">{f.type}</span>
      <span style={{ flex: 0.8 }} className="muted">{f.city}</span>
      <span style={{ flex: 1 }}>
        ₹{fmt(f.amount)} <span className="tiny muted">{f.billing === 'monthly' ? '/mo' : 'one-off'}</span>
        {f.featuredSubscriptionId && <span className="tiny" style={{ marginLeft: 6, color: 'var(--green)', display: 'inline-flex', alignItems: 'center', gap: 3 }}><RotateCcw size={11} /> auto</span>}
      </span>
      <span style={{ flex: 0.9 }} className="muted tiny">{f.status === 'active' ? `until ${fmtDate(f.expiresAt)}` : fmtDate(f.createdAt)}</span>
      <span style={{ flex: 1.3, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {actions ? (
          <>
            <button className="btn btn-pri btn-sm" onClick={() => approve(f.id)}>Approve</button>
            <button className="btn btn-danger btn-sm" onClick={() => reject(f.id)}>Reject</button>
          </>
        ) : (
          <span className="tag tag-green" style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>live <Check size={11} /></span>
        )}
      </span>
    </div>
  );

  const ExpiredRow = ({ f }: { f: LiveFeatured }) => (
    <div className="trow" style={{ minWidth: 640 }}>
      <span style={{ flex: 1.6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><TypeIcon type={f.type} /> {f.entityName}</span>
      <span style={{ flex: 0.9 }} className="muted">{f.type}</span>
      <span style={{ flex: 0.8 }} className="muted">{f.city}</span>
      <span style={{ flex: 1 }}>₹{fmt(f.amount)} <span className="tiny muted">{f.billing === 'monthly' ? '/mo' : 'one-off'}</span></span>
      <span style={{ flex: 0.9 }} className="muted tiny">expired {fmtDate(f.expiresAt)}</span>
      <span style={{ flex: 1.3, display: 'flex', gap: 6, justifyContent: 'flex-end', alignItems: 'center' }}>
        {f.expiryReminderSentAt && <span className="tiny muted">reminded {fmtDate(f.expiryReminderSentAt)}</span>}
        <button className="btn btn-ghost btn-sm" onClick={() => remind(f.id)}>Send renewal reminder</button>
      </span>
    </div>
  );

  return (
    <div className="stack fade" style={{ maxWidth: 1100, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div className="page-hd">
        <h1 className="page-title">Featured</h1>
        {pending.length > 0 && (
          <span className="chip" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontWeight: 700 }}>{pending.length} awaiting review</span>
        )}
      </div>

      <div className="kpi-grid">
        <Kpi label="Pending review" value={fmt(pending.length)} />
        <Kpi label="Live placements" value={fmt(active.length)} />
        <Kpi label="Monthly recurring" value={`₹${fmt(monthlyRecurring)}`} delta="from active placements" deltaColor="var(--green)" />
        <Kpi label="Per-event revenue" value={`₹${fmt(perEventRevenue)}`} delta="active one-offs" deltaColor="var(--muted)" />
        <Kpi label="Expired" value={fmt(expired.length)} delta="lapsed — not renewed" deltaColor="var(--red)" />
      </div>

      {/* Pricing */}
      <div className="card">
        <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Pricing</div>
        <div className="tiny hint" style={{ marginBottom: 10 }}>rates the organizer / promoter / line-up / venue apps charge to get featured{savingRates && ' · saving…'}</div>
        <div className="kpi-grid">
          {RATE_FIELDS.map((r) => (
            <div className="field" key={r.key}>
              <label>{r.label}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="muted">₹</span>
                <input
                  className="input"
                  style={{ padding: '6px 8px' }}
                  value={rates ? String(rates[r.key]) : ''}
                  inputMode="numeric"
                  disabled={!rates}
                  onChange={(e) => setRates((prev) => (prev ? { ...prev, [r.key]: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 } : prev))}
                  onBlur={(e) => updateRate({ [r.key]: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 } as Partial<LiveFeaturedRates>)}
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Approval queue */}
      <div className="tblwrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          <span className="display" style={{ fontWeight: 700 }}>Approval queue</span>
          <span className="small muted">{pending.length} pending</span>
        </div>
        {loading ? (
          <div className="trow muted">Loading…</div>
        ) : pending.length === 0 ? (
          <div className="trow muted">Nothing to review — all caught up.</div>
        ) : (
          pending.map((f) => <Row key={f.id} f={f} actions />)
        )}
      </div>

      {/* Live placements */}
      <div className="tblwrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          <span className="display" style={{ fontWeight: 700 }}>Live placements</span>
          <span className="small muted">{active.length} active</span>
        </div>
        {active.length === 0 ? (
          <div className="trow muted">No live featured placements.</div>
        ) : (
          active.map((f) => <Row key={f.id} f={f} />)
        )}
      </div>

      {/* Auto-renewing subscriptions — read-only; the owner cancels their own from their console */}
      <div className="tblwrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          <span className="display" style={{ fontWeight: 700 }}>Auto-renewal subscriptions</span>
          <span className="small muted">{activeSubs.length} active{haltedSubs.length > 0 && ` · ${haltedSubs.length} halted`}</span>
        </div>
        <div className="thead" style={{ minWidth: 620 }}>
          <span style={{ flex: 1.6 }}>Item</span>
          <span style={{ flex: 0.9 }}>Type</span>
          <span style={{ flex: 1 }}>₹/mo</span>
          <span style={{ flex: 0.8 }}>Payments</span>
          <span style={{ flex: 1.2 }}>Status</span>
          <span style={{ flex: 1 }}>Renews / ended</span>
        </div>
        {subs.length === 0 ? (
          <div className="trow muted">No auto-renewing placements yet.</div>
        ) : (
          subs.map((s) => (
            <div key={s.id} className="trow" style={{ minWidth: 620, background: s.status === 'halted' ? 'rgba(255,107,94,.06)' : undefined }}>
              <span style={{ flex: 1.6, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}><TypeIcon type={s.type} /> {s.entityName}</span>
              <span style={{ flex: 0.9 }} className="muted">{s.type}</span>
              <span style={{ flex: 1 }}>₹{fmt(s.amount)}</span>
              <span style={{ flex: 0.8 }} className="muted">{s.paidCount}</span>
              <span style={{ flex: 1.2 }} className={s.status === 'active' ? 'green' : s.status === 'halted' ? 'danger-text' : 'muted'}>
                {SUB_STATUS_LABEL[s.status] ?? s.status}
              </span>
              <span style={{ flex: 1 }} className="muted tiny">{s.currentEnd ? fmtDate(s.currentEnd) : '—'}</span>
            </div>
          ))
        )}
      </div>

      {/* Expired — lapsed placements, with a manual renewal-reminder action */}
      <div className="tblwrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          <span className="display" style={{ fontWeight: 700 }}>Expired</span>
          <span className="small muted">{expired.length} lapsed</span>
        </div>
        {expired.length === 0 ? (
          <div className="trow muted">Nothing has lapsed.</div>
        ) : (
          expired.map((f) => <ExpiredRow key={f.id} f={f} />)
        )}
      </div>
      <div className="tiny hint">
        approving a request makes it live on the guest home page + directory · placements are city-scoped and clearly labelled "Featured" ·
        rows marked <RotateCcw size={11} style={{ verticalAlign: -1 }} /> "auto" renew themselves via a real Razorpay subscription — no approval needed each cycle, see Auto-renewal subscriptions below
      </div>
    </div>
  );
}
