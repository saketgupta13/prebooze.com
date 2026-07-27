import { useEffect, useState } from 'react';
import { organizer } from '../../api';
import { ApiError } from '../../api/client';
import type { Coupon, Event } from '../../types';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
const GENDERS: { key: 'all' | 'women' | 'men' | 'other'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'women', label: 'Women' },
  { key: 'men', label: 'Men' },
  { key: 'other', label: 'Other' },
];
const audienceLabel = (g?: string) => (g === 'women' ? 'women only' : g === 'men' ? 'men only' : g === 'other' ? 'other' : 'everyone');

/** Real promo codes — GET/POST /organizer/coupons (upsert semantics, status
 * flip doubles as pause/resume). Same Coupon model + gender-audience
 * targeting as admin's platform-wide Promo codes (prebooze-admin Promos.tsx)
 * — just organizer-scoped. No delete endpoint exists server-side, so unlike
 * the old mock there's no delete button — pause achieves the same practical
 * effect (code stops applying) without pretending to remove it. */
export default function Coupons() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'flat'>('percent');
  const [value, setValue] = useState('50');
  const [maxDiscount, setMaxDiscount] = useState('100');
  const [usageLimit, setUsageLimit] = useState('500');
  const [perUser, setPerUser] = useState('1');
  const [scope, setScope] = useState('all');
  const [validTill, setValidTill] = useState('');
  const [firstOnly, setFirstOnly] = useState(false);
  const [gender, setGender] = useState<'all' | 'women' | 'men' | 'other'>('all');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState('');

  const load = () => {
    Promise.all([organizer.coupons(), organizer.events()])
      .then(([c, evs]) => { setCoupons(c); setEvents(evs); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const startEdit = (c: Coupon) => {
    setEditingId(c.id);
    setShowForm(true);
    setCode(c.code);
    setType(c.type);
    setValue(String(c.value));
    setMaxDiscount(c.maxDiscount ? String(c.maxDiscount) : '');
    setUsageLimit(String(c.usageLimit));
    setPerUser(String(c.perUserLimit));
    setScope(c.eventScope);
    setValidTill(c.validTill.slice(0, 10));
    setFirstOnly(c.firstTimeOnly);
    setGender(c.gender ?? 'all');
    setDescription(c.description ?? '');
    window.scrollTo(0, 0);
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return setErr('Coupon code is required');
    if (!+value || +value <= 0) return setErr('Discount value must be positive');
    setErr('');
    setBusy(true);
    try {
      const payload = {
        id: editingId ?? undefined,
        code: c,
        type,
        value: +value,
        maxDiscount: type === 'percent' ? +maxDiscount || undefined : undefined,
        usageLimit: +usageLimit || 100,
        perUserLimit: +perUser || 1,
        eventScope: scope,
        validTill: validTill ? new Date(validTill).toISOString() : undefined,
        firstTimeOnly: firstOnly,
        gender,
        description: description.trim() || undefined,
      };
      await organizer.upsertCoupon(payload);
      setEditingId(null);
      setCode('');
      setDescription('');
      load();
    } catch (e2) {
      setErr(e2 instanceof ApiError ? e2.message : 'Failed to save coupon');
    } finally {
      setBusy(false);
    }
  };

  const toggleStatus = async (c: Coupon) => {
    try {
      await organizer.upsertCoupon({ id: c.id, status: c.status === 'active' ? 'paused' : 'active' });
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to update coupon');
    }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24 }}>Promo codes</h1>
        <button className="btn btn-pri" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Hide form' : '+ Create promo code'}
        </button>
      </div>
      {err && <div className="danger-text small" style={{ marginBottom: 10 }}>✕ {err}</div>}

      {showForm && (
        <form className="card" style={{ marginBottom: 18 }} onSubmit={save}>
          <h3 style={{ marginBottom: 14 }}>{editingId ? `Edit promo code — ${code}` : 'New promo code'}</h3>
          <div className="form-row">
            <div className="field">
              <span>Code</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="FIRST50" disabled={!!editingId} />
            </div>
            <div className="field">
              <span>Type</span>
              <select value={type} onChange={(e) => setType(e.target.value as 'percent' | 'flat')}>
                <option value="percent">% off</option>
                <option value="flat">flat ₹ off</option>
              </select>
            </div>
            <div className="field">
              <span>{type === 'percent' ? '% value' : '₹ value'}</span>
              <input value={value} onChange={(e) => setValue(e.target.value)} inputMode="numeric" />
            </div>
          </div>
          <div className="form-row">
            {type === 'percent' && (
              <div className="field">
                <span>Max discount ₹</span>
                <input value={maxDiscount} onChange={(e) => setMaxDiscount(e.target.value)} inputMode="numeric" />
              </div>
            )}
            <div className="field">
              <span>Usage limit</span>
              <input value={usageLimit} onChange={(e) => setUsageLimit(e.target.value)} inputMode="numeric" />
            </div>
            <div className="field">
              <span>Per user</span>
              <input value={perUser} onChange={(e) => setPerUser(e.target.value)} inputMode="numeric" />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <span>Events</span>
              <select value={scope} onChange={(e) => setScope(e.target.value)}>
                <option value="all">All</option>
                {events.filter((e) => e.status === 'approved').map((e) => (
                  <option key={e.id} value={e.title}>
                    {e.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="field">
              <span>Valid till</span>
              <input type="date" value={validTill} onChange={(e) => setValidTill(e.target.value)} />
            </div>
          </div>
          <div className="form-row">
            <div className="field">
              <span>Audience</span>
              <select value={gender} onChange={(e) => setGender(e.target.value as typeof gender)}>
                {GENDERS.map((g) => <option key={g.key} value={g.key}>{g.label}</option>)}
              </select>
            </div>
            <div className="field" style={{ flex: 2 }}>
              <span>Note (optional — for your own reference)</span>
              <input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Instagram launch offer" />
            </div>
          </div>
          <label className="checkbox-row" style={{ marginBottom: 14 }}>
            <input type="checkbox" checked={firstOnly} onChange={(e) => setFirstOnly(e.target.checked)} />
            First-time users only
          </label>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-pri" disabled={busy}>{busy ? 'Saving…' : editingId ? 'Save changes ✓' : 'Save coupon'}</button>
            {editingId && (
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => {
                  setEditingId(null);
                  setCode('');
                }}
              >
                Cancel edit
              </button>
            )}
          </div>
        </form>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Promo codes</h3>
        {loading && <div className="muted small">Loading…</div>}
        {!loading && coupons.length === 0 && <div className="muted small">No promo codes yet.</div>}
        {coupons.map((c) => (
          <div key={c.id} className="evrow">
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="bold small">
                {c.code}{' '}
                <span className="muted" style={{ fontWeight: 500 }}>
                  ·{' '}
                  {c.type === 'percent'
                    ? `${c.value}% off${c.maxDiscount ? ` up to ₹${c.maxDiscount}` : ''}`
                    : `flat ₹${c.value} off`}
                  {c.firstTimeOnly ? ' · first-time users' : ''}
                  {c.gender && c.gender !== 'all' ? ` · ${audienceLabel(c.gender)}` : ''}
                </span>
              </div>
              <div className="tiny muted-2">
                used {c.used}/{c.usageLimit} · {c.eventScope === 'all' ? 'all events' : c.eventScope} ·
                valid till {fmtDate(c.validTill)}{c.description ? ` · ${c.description}` : ''}
              </div>
            </div>
            <span className={`badge ${c.status === 'active' ? 'badge-ok' : 'badge-pending'}`}>
              {c.status === 'active' ? 'Active' : 'Paused'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => toggleStatus(c)}>
              {c.status === 'active' ? 'Pause' : 'Resume'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={() => startEdit(c)}>✎ Edit</button>
          </div>
        ))}
      </div>
    </div>
  );
}
