import { useEffect, useState } from 'react';
import { liveSubTiers, liveSubscriptions, LiveApiError, type LiveSubTier, type LiveSubscription } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';

const fmt = (n: number) => Math.round(n).toLocaleString('en-IN');

/** Real subscription tiers + real subscribers for one role — shared by
 * Organizers/Promoters/Venues/Lineups, each scoped to their own role via
 * SubTiersService/SubscriptionsService's `role` filter. Reuses the shared
 * live-staff session already active on the page it's embedded in. */
export default function PlansAndSubscribers({ role, roleLabel }: { role: 'organizer' | 'promoter' | 'venue' | 'lineup'; roleLabel: string }) {
  const session = useLiveSession();
  const { token } = session;

  const [tiers, setTiers] = useState<LiveSubTier[]>([]);
  const [subs, setSubs] = useState<LiveSubscription[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [guests, setGuests] = useState('');

  const load = () => {
    if (!token) return;
    setLoading(true);
    setErr('');
    Promise.all([liveSubTiers.list(role), liveSubscriptions.list(role)])
      .then(([t, s]) => { setTiers(t); setSubs(s); })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [token]);

  if (!token) return null;

  const createTier = async (e: React.FormEvent) => {
    e.preventDefault();
    const p = parseInt(price.replace(/\D/g, ''), 10);
    if (!name.trim() || Number.isNaN(p)) { setErr('Name and a valid price are required'); return; }
    try {
      await liveSubTiers.create({ role, name: name.trim(), price: p, guests: role === 'promoter' && guests ? parseInt(guests.replace(/\D/g, ''), 10) : undefined });
      setName(''); setPrice(''); setGuests(''); setAdding(false);
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to create tier');
    }
  };

  const updatePrice = async (id: string, next: number, current: number) => {
    if (Number.isNaN(next) || next === current) return;
    try { await liveSubTiers.update(id, { price: next }); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to update'); }
  };

  const removeTier = async (id: string) => {
    if (!window.confirm('Delete this plan?')) return;
    try { await liveSubTiers.remove(id); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to delete'); }
  };

  return (
    <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div className="display" style={{ fontWeight: 700 }}>Plans &amp; subscribers</div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setAdding((v) => !v)}>{adding ? 'Cancel' : '+ Add plan'}</button>
      </div>
      {err && <div className="tiny" style={{ color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      {adding && (
        <form style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={createTier}>
          <div className="field" style={{ flex: 1, minWidth: 140 }}>
            <label>Name</label>
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Pro" autoFocus />
          </div>
          <div className="field" style={{ width: 120 }}>
            <label>Price ₹/mo</label>
            <input className="input" inputMode="numeric" value={price} onChange={(e) => setPrice(e.target.value)} />
          </div>
          {role === 'promoter' && (
            <div className="field" style={{ width: 130 }}>
              <label>Guests/mo</label>
              <input className="input" inputMode="numeric" value={guests} onChange={(e) => setGuests(e.target.value)} placeholder="-1 = unlimited" />
            </div>
          )}
          <button type="submit" className="btn btn-pri btn-sm">Save</button>
        </form>
      )}

      {tiers.length === 0 ? (
        <div className="tiny muted">No plans yet — nothing for {roleLabel.toLowerCase()}s to subscribe to.</div>
      ) : (
        <div className="tblwrap" style={{ border: 'none' }}>
          <div className="thead" style={{ minWidth: 420 }}>
            <span style={{ flex: 1.4 }}>Plan</span>
            <span style={{ flex: 1 }}>Price</span>
            <span style={{ flex: 1 }}>Razorpay</span>
            <span style={{ flex: 0.6 }} />
          </div>
          {tiers.map((t) => (
            <div key={t.id} className="trow" style={{ minWidth: 420 }}>
              <span style={{ flex: 1.4, fontWeight: 700 }}>{t.name}</span>
              <span style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 4 }}>
                ₹
                <input
                  className="input"
                  style={{ padding: '4px 6px', width: 80 }}
                  defaultValue={String(t.price)}
                  inputMode="numeric"
                  onBlur={(e) => updatePrice(t.id, parseInt(e.target.value.replace(/\D/g, ''), 10), t.price)}
                />
                /mo
              </span>
              <span style={{ flex: 1 }} className="tiny muted">{t.razorpayPlanId ? 'plan created' : 'no subscribers yet'}</span>
              <span style={{ flex: 0.6, display: 'flex', justifyContent: 'flex-end' }}>
                <button className="btn btn-danger btn-sm" onClick={() => removeTier(t.id)}>Delete</button>
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ borderTop: '1px solid rgba(139,195,74,.12)', paddingTop: 10 }}>
        <div className="tiny muted" style={{ marginBottom: 6 }}>{subs.length} real subscriber(s)</div>
        {subs.length === 0 ? (
          <div className="tiny muted">Nobody has subscribed yet.</div>
        ) : (
          <div className="tblwrap" style={{ border: 'none' }}>
            <div className="thead" style={{ minWidth: 420 }}>
              <span style={{ flex: 1.4 }}>{roleLabel}</span>
              <span style={{ flex: 1 }}>Plan</span>
              <span style={{ flex: 0.8 }}>Status</span>
              <span style={{ flex: 0.6 }}>Charges</span>
            </div>
            {subs.map((s) => (
              <div key={s.id} className="trow" style={{ minWidth: 420 }}>
                <span style={{ flex: 1.4, fontWeight: 700 }}>{s.entityName}</span>
                <span style={{ flex: 1 }}>{s.tier.name} — ₹{fmt(s.tier.price)}/mo</span>
                <span style={{ flex: 0.8 }}>
                  <span className={`tag ${s.status === 'active' ? 'tag-green' : ''}`}>{s.status}</span>
                </span>
                <span style={{ flex: 0.6 }} className="tiny muted">{s.paidCount}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
