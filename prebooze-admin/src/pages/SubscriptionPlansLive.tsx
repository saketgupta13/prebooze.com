import { useEffect, useState } from 'react';
import {
  clearLiveToken,
  getLiveToken,
  liveApiEnabled,
  liveAuth,
  liveSubscriptions,
  liveSubTiers,
  setLiveToken,
  LiveApiError,
  type LiveSubTier,
  type LiveSubscription,
} from '../lib/liveApi';

const ROLES: LiveSubTier['role'][] = ['organizer', 'promoter', 'venue', 'lineup'];
const ROLE_LABEL: Record<string, string> = { organizer: 'Organizer', promoter: 'Promoter', venue: 'Venue', lineup: 'Line-up' };

/** The one real, live-backend page in prebooze-admin — see lib/liveApi.ts.
 * Manages `SubTier` (what's actually for sale) and shows real `RoleSubscription`
 * rows (who's actually subscribed) across all 4 billable roles, straight
 * against the production Razorpay-backed API — not the mock store. */
export default function SubscriptionPlansLive() {
  const [token, setToken] = useState(getLiveToken());
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [staffId, setStaffId] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [staffName, setStaffName] = useState('');

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

  if (!liveApiEnabled()) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Subscription plans (live)</h1>
        <div className="card">Live API not configured — set `VITE_API_URL` in `.env.local` to reach the real backend.</div>
      </div>
    );
  }

  const submitLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr('');
    try {
      const res = await liveAuth.login(email.trim(), password);
      if (res.requires2fa && res.staffId) {
        setStaffId(res.staffId);
        return;
      }
      if (res.token) {
        setLiveToken(res.token);
        setToken(res.token);
        setStaffName(res.staff?.name ?? email);
      }
    } catch (e) {
      setLoginErr(e instanceof LiveApiError ? e.message : 'Login failed');
    }
  };

  const submit2fa = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginErr('');
    try {
      const res = await liveAuth.verify2fa(staffId!, code.trim());
      setLiveToken(res.token);
      setToken(res.token);
      setStaffName(res.staff?.name ?? email);
    } catch (e) {
      setLoginErr(e instanceof LiveApiError ? e.message : 'Invalid code');
    }
  };

  const logout = () => {
    clearLiveToken();
    setToken(null);
    setTiers([]);
    setSubs([]);
  };

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

  if (!token) {
    return (
      <div className="stack fade" style={{ maxWidth: 380 }}>
        <h1 className="page-title">Subscription plans (live)</h1>
        <div className="tiny hint" style={{ marginTop: -6 }}>
          This page talks to the real backend — sign in with your real staff account (separate from the mock admin session above).
        </div>
        {!staffId ? (
          <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={submitLogin}>
            <div className="field">
              <label>Staff email</label>
              <input className="input" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
            </div>
            <div className="field">
              <label>Password</label>
              <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            {loginErr && <div className="tiny" style={{ color: 'var(--red)' }}>{loginErr}</div>}
            <button type="submit" className="btn btn-pri">Sign in</button>
          </form>
        ) : (
          <form className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }} onSubmit={submit2fa}>
            <div className="field">
              <label>6-digit code (emailed to you)</label>
              <input className="input" value={code} onChange={(e) => setCode(e.target.value)} autoFocus />
            </div>
            {loginErr && <div className="tiny" style={{ color: 'var(--red)' }}>{loginErr}</div>}
            <button type="submit" className="btn btn-pri">Verify</button>
          </form>
        )}
      </div>
    );
  }

  return (
    <div className="stack fade" style={{ maxWidth: 1000, gap: 14 }}>
      <div className="page-hd">
        <h1 className="page-title">Subscription plans (live)</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="tiny muted">signed in as {staffName || 'staff'}</span>
          <button className="btn btn-ghost btn-sm" onClick={logout}>Sign out</button>
        </div>
      </div>
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
