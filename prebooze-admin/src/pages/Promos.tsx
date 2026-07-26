import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Tag } from '../components/ui';
import { livePromos, LiveApiError, type LivePromo } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Promo codes';
const GENDERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'women', label: 'Women' },
  { key: 'men', label: 'Men' },
  { key: 'other', label: 'Other' },
];
const audienceLabel = (g: string) =>
  g === 'all' ? 'everyone' : g === 'women' ? 'women only' : g === 'men' ? 'men only' : 'other';
const discountLabel = (p: LivePromo) => (p.type === 'percent' ? `${p.value}% off${p.maxDiscount ? ` (up to ₹${p.maxDiscount})` : ''}` : `₹${p.value} off`);

/** Real platform-wide promo codes — Coupon rows with organizerId: null
 * (PromosService), the same model an organizer's own coupons use. */
export default function Promos() {
  const session = useLiveSession();
  const { token } = session;

  const [promos, setPromos] = useState<LivePromo[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [code, setCode] = useState('');
  const [ptype, setPtype] = useState<'percent' | 'flat'>('percent');
  const [value, setValue] = useState('');
  const [maxCap, setMaxCap] = useState('');
  const [gender, setGender] = useState('all');
  const [description, setDescription] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    livePromos
      .list()
      .then(setPromos)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    const c = code.trim().toUpperCase();
    if (!c) { setErr('Enter a code first'); return; }
    const v = parseFloat(value) || 10;
    if (ptype === 'percent' && v > 100) { setErr('Percentage discount cannot exceed 100%'); return; }
    const cap = maxCap ? parseInt(maxCap, 10) : undefined;
    try {
      await livePromos.create({
        code: c,
        type: ptype,
        value: v,
        maxDiscount: ptype === 'percent' ? cap : undefined,
        gender,
        description: description.trim() || undefined,
      });
      setCode(''); setValue(''); setMaxCap(''); setGender('all'); setDescription('');
      load();
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to create');
    }
  };

  const remove = async (c: string) => {
    if (!window.confirm(`Remove promo ${c}?`)) return;
    try { await livePromos.remove(c); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}
      <h1 className="page-title">Promo codes</h1>

      <div className="tblwrap">
        <div className="thead" style={{ minWidth: 560 }}>
          <span style={{ flex: 1.2 }}>Code</span>
          <span style={{ flex: 1.3 }}>Discount</span>
          <span style={{ flex: 1.2 }}>Scope</span>
          <span style={{ flex: 1 }}>Audience</span>
          <span style={{ flex: 0.8 }}>Used</span>
          <span style={{ flex: 1 }}>Status</span>
          <span style={{ width: 84 }} />
        </div>
        {promos.map((p) => (
          <div key={p.id} className="trow" style={{ minWidth: 560 }}>
            <span style={{ flex: 1.2, fontWeight: 700 }}>
              {p.code}
              {p.description && <span className="tiny muted" style={{ display: 'block', fontWeight: 400 }}>{p.description}</span>}
            </span>
            <span style={{ flex: 1.3 }} className="muted">{discountLabel(p)}</span>
            <span style={{ flex: 1.2 }} className="muted">{p.eventScope === 'all' ? (p.firstTimeOnly ? 'first booking' : 'all events') : p.eventScope}</span>
            <span style={{ flex: 1 }} className="muted">{audienceLabel(p.gender)}</span>
            <span style={{ flex: 0.8 }}>{p.used}/{p.usageLimit}</span>
            <span style={{ flex: 1 }}>
              {p.status === 'active' ? <Tag label="Active" cls="tag-green" /> : <Tag label="Paused" cls="" />}
            </span>
            <span style={{ width: 84, display: 'flex', justifyContent: 'flex-end', gap: 4 }}>
              <Link to={`/promos/${p.code}/edit`} className="btn btn-ghost btn-sm" style={{ padding: '3px 8px' }}>✎</Link>
              <button className="btn btn-danger btn-sm" style={{ padding: '3px 8px' }} onClick={() => remove(p.code)}>✕</button>
            </span>
          </div>
        ))}
        {promos.length === 0 && !loading && <div className="trow muted">No promo codes yet.</div>}
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
        <input
          className="input"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description — shown to staff and on the guest checkout screen"
        />
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
