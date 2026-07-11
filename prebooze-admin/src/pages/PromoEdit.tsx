import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
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

export default function PromoEdit() {
  const { code } = useParams();
  const navigate = useNavigate();
  const { promos, events, updatePromo, toast } = useAdmin();
  const promo = promos.find((p) => p.code === code);

  const [type, setType] = useState<'percent' | 'flat'>(promo?.type ?? 'percent');
  const [value, setValue] = useState(String(promo?.value ?? 10));
  const [maxCap, setMaxCap] = useState(promo?.maxCap ? String(promo.maxCap) : '');
  const [scope, setScope] = useState(promo?.scope ?? 'all events');
  const [gender, setGender] = useState<Gender>(promo?.gender ?? 'all');

  if (!promo) {
    return (
      <div className="stack fade">
        <h1 className="page-title">Promo code not found</h1>
        <Link to="/promos" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Promo codes</Link>
      </div>
    );
  }

  const numValue = parseFloat(value) || 0;
  const numCap = maxCap ? parseInt(maxCap, 10) : undefined;
  const previewTicket = 450;
  const rawDiscount = type === 'percent' ? (previewTicket * numValue) / 100 : numValue;
  const discount = Math.min(rawDiscount, numCap ?? rawDiscount, previewTicket);

  const save = (e: React.FormEvent) => {
    e.preventDefault();
    if (numValue <= 0) {
      toast('Discount value must be more than 0');
      return;
    }
    if (type === 'percent' && numValue > 100) {
      toast('Percentage discount cannot exceed 100%');
      return;
    }
    updatePromo(promo.code, {
      type,
      value: numValue,
      maxCap: type === 'percent' ? numCap : undefined,
      scope,
      gender,
      discountLabel: promoLabel(type, numValue, type === 'percent' ? numCap : undefined),
    });
    navigate('/promos');
  };

  return (
    <form className="stack fade" style={{ maxWidth: 560, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/promos" style={{ fontSize: 13 }}>← Promo codes</Link>
        <h1 className="page-title">Edit {promo.code}</h1>
        {promo.status === 'active' ? (
          <Tag label="Active" cls="tag-green" />
        ) : promo.status === 'paused' ? (
          <Tag label="Paused" cls="" />
        ) : (
          <Tag label="Expired" cls="tag-dim" />
        )}
        <div style={{ flex: 1 }} />
        {promo.status !== 'expired' && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={() => updatePromo(promo.code, { status: promo.status === 'active' ? 'paused' : 'active' })}
          >
            {promo.status === 'active' ? '⏸ Pause code' : '▶ Resume code'}
          </button>
        )}
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="display" style={{ fontWeight: 700 }}>Discount</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button
            type="button"
            className={`chip ${type === 'percent' ? 'on' : ''}`}
            onClick={() => setType('percent')}
          >
            % Percentage discount
          </button>
          <button
            type="button"
            className={`chip ${type === 'flat' ? 'on' : ''}`}
            onClick={() => setType('flat')}
          >
            ₹ Flat discount
          </button>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <div className="field" style={{ flex: 1 }}>
            <label>{type === 'percent' ? 'Percentage off (%)' : 'Flat amount off (₹)'}</label>
            <input className="input" value={value} onChange={(e) => setValue(e.target.value.replace(/[^0-9.]/g, ''))} inputMode="numeric" />
          </div>
          {type === 'percent' && (
            <div className="field" style={{ flex: 1 }}>
              <label>Max discount cap ₹ (optional)</label>
              <input className="input" value={maxCap} onChange={(e) => setMaxCap(e.target.value.replace(/\D/g, ''))} inputMode="numeric" placeholder="e.g. 100" />
            </div>
          )}
        </div>
        <div className="dashed-box tiny" style={{ color: 'var(--muted)' }}>
          <b style={{ color: 'var(--text)' }}>Preview — ₹{previewTicket} ticket:</b> guest saves{' '}
          <b className="green">₹{Math.round(discount)}</b> → pays ₹{previewTicket - Math.round(discount)} + fees ·
          label shows as “{promoLabel(type, numValue, type === 'percent' ? numCap : undefined)}”
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="display" style={{ fontWeight: 700 }}>Scope &amp; audience</div>
        <div className="field">
          <label>Applies to</label>
          <select className="input" value={scope} onChange={(e) => setScope(e.target.value)}>
            <option value="all events">All events</option>
            <option value="first booking">First booking only</option>
            {events.filter((e) => e.status === 'live').map((e) => (
              <option key={e.id} value={e.title}>{e.title}</option>
            ))}
          </select>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <span className="small" style={{ fontWeight: 700, color: '#c7cbb9' }}>Audience — gender:</span>
          {GENDERS.map((g) => (
            <button type="button" key={g.key} className={`chip ${gender === g.key ? 'on' : ''}`} onClick={() => setGender(g.key)}>
              {g.label}{gender === g.key ? ' ✓' : ''}
            </button>
          ))}
        </div>
        <div className="tiny hint">usage: {promo.usedLabel} · checked against verified profile gender at checkout</div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>Save promo code</button>
        <Link to="/promos" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
