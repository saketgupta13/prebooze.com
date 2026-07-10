import { useState } from 'react';
import { useApp } from '../../store/AppContext';
import { EVENTS } from '../../data/mock';
import type { Coupon } from '../../types';

export default function Coupons() {
  const { coupons, addCoupon, toggleCoupon } = useApp();
  const [showForm, setShowForm] = useState(true);

  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'flat'>('percent');
  const [value, setValue] = useState('50');
  const [maxDiscount, setMaxDiscount] = useState('100');
  const [usageLimit, setUsageLimit] = useState('500');
  const [perUser, setPerUser] = useState('1');
  const [scope, setScope] = useState('all');
  const [validTill, setValidTill] = useState('');
  const [firstOnly, setFirstOnly] = useState(false);
  const [err, setErr] = useState('');

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) return setErr('Coupon code is required');
    if (coupons.some((x) => x.code === c)) return setErr(`${c} already exists`);
    if (!+value || +value <= 0) return setErr('Discount value must be positive');
    const coupon: Coupon = {
      id: 'c' + Date.now(),
      code: c,
      type,
      value: +value,
      maxDiscount: type === 'percent' ? +maxDiscount || undefined : undefined,
      usageLimit: +usageLimit || 100,
      used: 0,
      perUserLimit: +perUser || 1,
      eventScope: scope,
      validTill: validTill
        ? new Date(validTill).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
        : '31 Dec',
      firstTimeOnly: firstOnly,
      status: 'active',
    };
    addCoupon(coupon);
    setCode('');
    setErr('');
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h1 style={{ fontSize: 24 }}>Coupons</h1>
        <button className="btn btn-pri" onClick={() => setShowForm((v) => !v)}>
          {showForm ? 'Hide form' : '+ Create coupon'}
        </button>
      </div>

      {showForm && (
        <form className="card" style={{ marginBottom: 18 }} onSubmit={save}>
          <h3 style={{ marginBottom: 14 }}>New coupon</h3>
          <div className="form-row">
            <div className="field">
              <span>Code</span>
              <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="FIRST50" />
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
                {EVENTS.filter((e) => e.organizerId === 'livewire' && e.status === 'approved').map((e) => (
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
          <label className="checkbox-row" style={{ marginBottom: 14 }}>
            <input type="checkbox" checked={firstOnly} onChange={(e) => setFirstOnly(e.target.checked)} />
            First-time users only
          </label>
          {err && (
            <div className="danger-text small" style={{ marginBottom: 10 }}>
              ✕ {err}
            </div>
          )}
          <button className="btn btn-pri">Save coupon</button>
        </form>
      )}

      <div className="card">
        <h3 style={{ marginBottom: 8 }}>Active coupons</h3>
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
                </span>
              </div>
              <div className="tiny muted-2">
                used {c.used}/{c.usageLimit} · {c.eventScope === 'all' ? 'all events' : c.eventScope} ·
                valid till {c.validTill}
              </div>
            </div>
            <span className={`badge ${c.status === 'active' ? 'badge-ok' : 'badge-pending'}`}>
              {c.status === 'active' ? 'Active' : 'Paused'}
            </span>
            <button className="btn btn-ghost btn-sm" onClick={() => toggleCoupon(c.id)}>
              {c.status === 'active' ? 'Pause' : 'Resume'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
