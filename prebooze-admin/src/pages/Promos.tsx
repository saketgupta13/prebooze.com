import { useState } from 'react';
import { useAdmin } from '../store/AdminContext';
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
  const [value, setValue] = useState('');
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
    const v = value.trim() || '10';
    addPromo({
      code: c,
      discountLabel: v.includes('₹') ? v : `${v}%`,
      scope: 'all events',
      gender,
      usedLabel: '0/∞',
      status: 'active',
    });
    setCode('');
    setValue('');
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
          <input
            className="input"
            style={{ width: 170 }}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="value (e.g. 10 or ₹150)"
          />
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
