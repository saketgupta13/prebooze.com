import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAdmin } from '../store/AdminContext';
import { promoLabel } from '../store/data';
import { Tag } from '../components/ui';
import type { Gender } from '../types';

const GENDERS: { key: Gender; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'women', label: 'Women' },
  { key: 'men', label: 'Men' },
  { key: 'other', label: 'Other' },
];

const audienceLabel = (g: Gender) =>
  g === 'all' ? 'everyone' : g === 'women' ? 'women only' : g === 'men' ? 'men only' : 'other';

export default function Promos() {
  const { promos, addPromo, toast } = useAdmin();
  const [code, setCode] = useState('');
  const [ptype, setPtype] = useState<'percent' | 'flat'>('percent');
  const [value, setValue] = useState('');
  const [maxCap, setMaxCap] = useState('');
  const [gender, setGender] = useState<Gender>('all');

  const create = (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) {
      toast('Enter a code first');
      return;
    }
    if (promos.some((p) => p.code === c)) {
      toast(`${c} already exists`);
      return;
    }
    const v = parseFloat(value) || 10;
    if (ptype === 'percent' && v > 100) {
      toast('Percentage discount cannot exceed 100%');
      return;
    }
    const cap = maxCap ? parseInt(maxCap, 10) : undefined;
    addPromo({
      code: c,
      discountLabel: promoLabel(ptype, v, ptype === 'percent' ? cap : undefined),
      scope: 'all events',
      gender,
      usedLabel: '0/∞',
      status: 'active',
      type: ptype,
      value: v,
      maxCap: ptype === 'percent' ? cap : undefined,
    });
    setCode('');
    setValue('');
    setMaxCap('');
    setGender('all');
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900 }}>
      <h1 className="page-title">Promo codes</h1>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 560 }}>
          <span style={{ flex: 1.2 }}>Code</span>
          <span style={{ flex: 1.3 }}>Discount</span>
          <span style={{ flex: 1.2 }}>Scope</span>
          <span style={{ flex: 1 }}>Audience</span>
          <span style={{ flex: 0.8 }}>Used</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ width: 50 }} />
        </div>
        {promos.map((p) => (
          <div key={p.code} className="trow" style={{ minWidth: 560 }}>
            <span style={{ flex: 1.2, fontWeight: 700 }}>{p.code}</span>
            <span style={{ flex: 1.3 }} className="muted">{p.discountLabel}</span>
            <span style={{ flex: 1.2 }} className="muted">{p.scope}</span>
            <span style={{ flex: 1 }} className="muted">{audienceLabel(p.gender)}</span>
            <span style={{ flex: 0.8 }}>{p.usedLabel}</span>
            <span style={{ flex: 1 }}>
              {p.status === 'active' ? (
                <Tag label="Active" cls="tag-green" />
              ) : p.status === 'paused' ? (
                <Tag label="Paused" cls="" />
              ) : (
                <Tag label="Expired" cls="tag-dim" />
              )}
            </span>
            <span style={{ width: 50, display: 'flex', justifyContent: 'flex-end' }}>
              <Link to={`/promos/${p.code}/edit`} className="btn btn-ghost btn-sm" style={{ padding: '3px 8px' }}>✎</Link>
            </span>
          </div>
        ))}
      </div>

      <form className="card" style={{ border: '1px solid var(--green)', display: 'flex', flexDirection: 'column', gap: 8 }} onSubmit={create}>
        <div className="display" style={{ fontWeight: 700 }}>New promo code</div>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <input
            className="input"
            style={{ flex: 1, minWidth: 100, textTransform: 'uppercase' }}
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="CODE"
          />
          <select className="input" style={{ width: 150 }} value={ptype} onChange={(e) => setPtype(e.target.value as 'percent' | 'flat')}>
            <option value="percent">% percentage off</option>
            <option value="flat">₹ flat off</option>
          </select>
          <input
            className="input"
            style={{ width: 110 }}
            value={value}
            onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))}
            placeholder={ptype === 'percent' ? '% value' : '₹ value'}
            inputMode="numeric"
          />
          {ptype === 'percent' && (
            <input
              className="input"
              style={{ width: 120 }}
              value={maxCap}
              onChange={(e) => setMaxCap(e.target.value.replace(/\D/g, ''))}
              placeholder="max cap ₹"
              inputMode="numeric"
            />
          )}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="small" style={{ fontWeight: 700, color: '#c7cbb9' }}>Audience — gender:</span>
          {GENDERS.map((g) => (
            <button
              type="button"
              key={g.key}
              className={`chip ${gender === g.key ? 'on' : ''}`}
              onClick={() => setGender(g.key)}
            >
              {g.label}
              {gender === g.key ? ' ✓' : ''}
            </button>
          ))}
          <span className="tiny hint">· checked against verified profile gender at checkout</span>
        </div>
        <button type="submit" className="btn btn-pri" style={{ alignSelf: 'flex-start' }}>Create code</button>
        <div className="tiny hint">gender-targeted codes enable ladies-night pricing without separate tiers</div>
      </form>
    </div>
  );
}
