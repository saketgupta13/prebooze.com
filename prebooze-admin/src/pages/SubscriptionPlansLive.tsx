import { useEffect, useState } from 'react';
import { liveSubscriptions, liveSubTiers, LiveApiError, type LiveSubTier, type LiveSubscription } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const ROLES: LiveSubTier['role'][] = ['organizer', 'promoter', 'venue', 'lineup'];
const ROLE_LABEL: Record<string, string> = { organizer: 'Organizer', promoter: 'Promoter', venue: 'Venue', lineup: 'Line-up' };
const TITLE = 'Subscription plans (live)';

/** The first real, live-backend page in prebooze-admin — see lib/liveApi.ts.
 * Manages `SubTier` (what's actually for sale) and shows real `RoleSubscription`
 * rows (who's actually subscribed) across all 4 billable roles, straight
 * against the production Razorpay-backed API — not the mock store. */
export default function SubscriptionPlansLive() {
  const session = useLiveSession();
  const { token } = session;

  const [tiers, setTiers] = useState<LiveSubTier[]>([]);
  const [subs, setSubs] = useState<LiveSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [newRole, setNewRole] = useState<LiveSubTier['role']>('organizer');
  const [newName, setNewName] = useState('');
  const [newPrice, setNewPrice] = useState('');
  const [newGuests, setNewGuests] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveSubTiers.list(), liveSubscriptions.list()])
      .then(([t, s]) => {
        setTiers(t);
        setSubs(s);
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

  const createTier = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    const price = parseInt(newPrice.replace(/\D/g, ''), 10);
    if (!newName.trim() || Number.isNaN(price)) {
      setErr('Name and a valid price are required');
      return;
    }
    try {
      await liveSubTiers.create({
        role: newRole,
        name: newName.trim(),
        price,
        guests: newRole === 'promoter' && newGuests ? parseInt(newGuests.replace(/\D/g, ''), 10) : undefined,
      });
      setNewName('');
      setNewPrice('');
      setNewGuests('');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to create tier');
    }
  };

  const updatePrice = async (id: string, price: number) => {
    try {
      await liveSubTiers.update(id, { price });
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update');
    }
  };

  const removeTier = async (id: string) => {
    if (!window.confirm('Delete this tier?')) return;
    try {
      await liveSubTiers.remove(id);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to delete');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 1000, gap: 14 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      <div className="tiny hint" style={{ marginTop: -6 }}>
        real tiers, real Razorpay plans, real subscribers — organizer/venue/line-up start with none on purpose, no invented pricing.
      </div>

      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="card">
        <div className="display" style={{ fontWeight: 700, marginBottom: 10 }}>Add a plan</div>
        <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={createTier}>
          <div className="field" style={{ width: 130 }}>
            <label>Role</label>
            <select className="input" value={newRole} onChange={(e) => setNewRole(e.target.value as LiveSubTier['role'])}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{ROLE_LABEL[r]}</option>
              ))}
            </select>
          </div>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Name</label>
            <input className="input" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Pro" />
          </div>
          <div className="field" style={{ width: 120 }}>
            <label>Price ₹/mo</label>
            <input className="input" inputMode="numeric" value={newPrice} onChange={(e) => setNewPrice(e.target.value)} />
          </div>
          {newRole === 'promoter' && (
            <div className="field" style={{ width: 130 }}>
              <label>Guests/mo</label>
              <input className="input" inputMode="numeric" value={newGuests} onChange={(e) => setNewGuests(e.target.value)} placeholder="-1 = unlimited" />
            </div>
          )}
          <button type="submit" className="btn btn-pri">+ Add</button>
        </form>
      </div>

      {ROLES.map((role) => {
        const roleTiers = tiers.filter((t) => t.role === role);
        return (
          <div className="tblwrap" key={role}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
              <span className="display" style={{ fontWeight: 700 }}>{ROLE_LABEL[role]} plans</span>
              <span className="small muted">{roleTiers.length} plan(s)</span>
            </div>
            {roleTiers.length === 0 ? (
              <div className="trow muted">No plans yet — nothing for {ROLE_LABEL[role].toLowerCase()}s to subscribe to.</div>
            ) : (
              roleTiers.map((t) => (
                <div key={t.id} className="trow" style={{ minWidth: 480 }}>
                  <span style={{ flex: 1.4, fontWeight: 700 }}>{t.name}</span>
                  <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                    ₹
                    <input
                      className="input"
                      style={{ padding: '4px 6px', width: 80 }}
                      defaultValue={String(t.price)}
                      inputMode="numeric"
                      onBlur={(e) => {
                        const v = parseInt(e.target.value.replace(/\D/g, ''), 10);
                        if (!Number.isNaN(v) && v !== t.price) updatePrice(t.id, v);
                      }}
                    />
                    /mo
                  </span>
                  <span style={{ flex: 1 }} className="tiny muted">{t.razorpayPlanId ? 'Razorpay plan created' : 'no subscribers yet'}</span>
                  <span style={{ flex: 0.6, display: 'flex', justifyContent: 'flex-end' }}>
                    <button className="btn btn-danger btn-sm" onClick={() => removeTier(t.id)}>Delete</button>
                  </span>
                </div>
              ))
            )}
          </div>
        );
      })}

      <div className="tblwrap">
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid rgba(139,195,74,.15)' }}>
          <span className="display" style={{ fontWeight: 700 }}>Real subscribers</span>
          <span className="small muted">{subs.length} subscription(s)</span>
        </div>
        {subs.length === 0 ? (
          <div className="trow muted">Nobody has subscribed yet.</div>
        ) : (
          subs.map((s) => (
            <div key={s.id} className="trow" style={{ minWidth: 480 }}>
              <span style={{ flex: 1.4, fontWeight: 700 }}>{s.entityName}</span>
              <span style={{ flex: 0.8 }} className="muted">{ROLE_LABEL[s.role] ?? s.role}</span>
              <span style={{ flex: 1 }}>{s.tier.name} — ₹{s.tier.price}/mo</span>
              <span style={{ flex: 0.8 }}>
                <span className={`tag ${s.status === 'active' ? 'tag-green' : ''}`}>{s.status}</span>
              </span>
              <span style={{ flex: 0.6 }} className="tiny muted">{s.paidCount} charge(s)</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
