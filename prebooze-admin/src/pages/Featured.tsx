import { useAdmin } from '../store/AdminContext';
import { fmt } from '../store/data';
import { Kpi } from '../components/ui';
import type { FeaturedRates } from '../types';

const TYPE_ICON: Record<string, string> = { event: '🎫', organizer: '🎧', promoter: '📣', lineup: '🎤' };

const RATE_FIELDS: { key: keyof FeaturedRates; label: string }[] = [
  { key: 'perEvent', label: 'Per event (one-off)' },
  { key: 'organizerMonthly', label: 'Organizer / month' },
  { key: 'promoterMonthly', label: 'Promoter / month' },
  { key: 'lineupMonthly', label: 'Line-up / month' },
];

export default function Featured() {
  const { featuredRequests, featuredRates, approveFeatured, rejectFeatured, updateFeaturedRate } = useAdmin();

  const pending = featuredRequests.filter((f) => f.status === 'pending');
  const active = featuredRequests.filter((f) => f.status === 'active');
  const monthlyRecurring = active.filter((f) => f.billing === 'monthly').reduce((a, f) => a + f.amount, 0);
  const perEventRevenue = active.filter((f) => f.billing === 'per_event').reduce((a, f) => a + f.amount, 0);

  const Row = ({ f, actions }: { f: (typeof featuredRequests)[number]; actions?: boolean }) => (
    <div className="trow" style={{ minWidth: 640, background: f.status === 'pending' ? 'rgba(255,107,94,.06)' : undefined }}>
      <span style={{ flex: 1.6, fontWeight: 700 }}>{TYPE_ICON[f.type]} {f.name}</span>
      <span style={{ flex: 0.9 }} className="muted">{f.type}</span>
      <span style={{ flex: 0.8 }} className="muted">{f.city}</span>
      <span style={{ flex: 1 }}>₹{fmt(f.amount)} <span className="tiny muted">{f.billing === 'monthly' ? '/mo' : 'one-off'}</span></span>
      <span style={{ flex: 0.9 }} className="muted tiny">{f.status === 'active' ? `until ${f.expiresAt}` : f.requestedAt}</span>
      <span style={{ flex: 1.3, display: 'flex', gap: 6, justifyContent: 'flex-end' }}>
        {actions ? (
          <>
            <button className="btn btn-pri btn-sm" onClick={() => approveFeatured(f.id)}>Approve</button>
            <button className="btn btn-danger btn-sm" onClick={() => rejectFeatured(f.id)}>Reject</button>
          </>
        ) : (
          <span className="tag tag-green">live ✓</span>
        )}
      </span>
    </div>
  );

  return (
    <div className="stack fade" style={{ maxWidth: 1100, gap: 14 }}>
      <div className="page-hd">
        <h1 className="page-title">Featured</h1>
        {pending.length > 0 && (
          <span className="chip" style={{ borderColor: 'var(--red)', color: 'var(--red)', fontWeight: 700 }}>{pending.length} awaiting review</span>
        )}
      </div>

      <div className="kpi-grid">
        <Kpi label="Pending review" value={fmt(pending.length)} />
        <Kpi label="Live placements" value={fmt(active.length)} />
        <Kpi label="Monthly recurring" value={`₹${fmt(monthlyRecurring)}`} delta="from active subs" deltaColor="var(--green)" />
        <Kpi label="Per-event revenue" value={`₹${fmt(perEventRevenue)}`} delta="active one-offs" deltaColor="var(--muted)" />
      </div>

      {/* Pricing */}
      <div className="card">
        <div className="display" style={{ fontWeight: 700, marginBottom: 4 }}>Pricing</div>
        <div className="tiny hint" style={{ marginBottom: 10 }}>rates the organizer / promoter / line-up apps charge to get featured</div>
        <div className="kpi-grid">
          {RATE_FIELDS.map((r) => (
            <div className="field" key={r.key}>
              <label>{r.label}</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span className="muted">₹</span>
                <input
                  className="input"
                  style={{ padding: '6px 8px' }}
                  value={String(featuredRates[r.key])}
                  inputMode="numeric"
                  onChange={(e) => updateFeaturedRate({ [r.key]: parseInt(e.target.value.replace(/\D/g, ''), 10) || 0 } as Partial<FeaturedRates>)}
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
        {pending.length === 0 ? (
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
      <div className="tiny hint">approving a request makes it live on the guest home page + directory · placements are city-scoped and clearly labelled “Featured”</div>
    </div>
  );
}
