import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Tag } from '../components/ui';
import { livePromos, liveEvents, LiveApiError, type LivePromo, type LiveEvent } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate } from '../components/LiveChrome';

const TITLE = 'Edit promo code';
const GENDERS: { key: string; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'women', label: 'Women' },
  { key: 'men', label: 'Men' },
  { key: 'other', label: 'Other' },
];
const promoLabel = (type: 'percent' | 'flat', value: number, cap?: number) =>
  type === 'percent' ? `${value}% off${cap ? ` (up to ₹${cap})` : ''}` : `₹${value} off`;

export default function PromoEdit() {
  const { code } = useParams();
  const navigate = useNavigate();
  const session = useLiveSession();
  const { token } = session;

  const [promo, setPromo] = useState<LivePromo | null>(null);
  const [events, setEvents] = useState<LiveEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const [type, setType] = useState<'percent' | 'flat'>('percent');
  const [value, setValue] = useState('10');
  const [maxCap, setMaxCap] = useState('');
  const [applies, setApplies] = useState('all events');
  const [gender, setGender] = useState('all');
  const [description, setDescription] = useState('');

  const load = () => {
    if (!code) return;
    setLoading(true);
    setErr('');
    Promise.all([livePromos.list(), liveEvents.list('approved')])
      .then(([promos, evs]) => {
        const p = promos.find((x) => x.code === code);
        setPromo(p ?? null);
        setEvents(evs);
        if (p) {
          setType(p.type);
          setValue(String(p.value));
          setMaxCap(p.maxDiscount ? String(p.maxDiscount) : '');
          setApplies(p.firstTimeOnly ? 'first booking' : p.eventScope === 'all' ? 'all events' : p.eventScope);
          setGender(p.gender);
          setDescription(p.description ?? '');
        }
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, code]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  if (!loading && !promo) {
    return (
      <div className="stack fade">
        {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
        <h1 className="page-title">Promo code not found</h1>
        <Link to="/promos" className="btn btn-ghost" style={{ width: 'fit-content' }}>← Promo codes</Link>
      </div>
    );
  }
  if (!promo) {
    return <div className="stack fade"><div className="tiny muted">Loading…</div></div>;
  }

  const numValue = parseFloat(value) || 0;
  const numCap = maxCap ? parseInt(maxCap, 10) : undefined;
  const previewTicket = 450;
  const rawDiscount = type === 'percent' ? (previewTicket * numValue) / 100 : numValue;
  const discount = Math.min(rawDiscount, numCap ?? rawDiscount, previewTicket);

  const toggleStatus = async () => {
    try {
      await livePromos.update(promo.code, { status: promo.status === 'active' ? 'paused' : 'active' });
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update');
    }
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (numValue <= 0) { setErr('Discount value must be more than 0'); return; }
    if (type === 'percent' && numValue > 100) { setErr('Percentage discount cannot exceed 100%'); return; }
    try {
      await livePromos.update(promo.code, {
        value: numValue,
        maxDiscount: type === 'percent' ? numCap : undefined,
        eventScope: applies === 'first booking' ? 'all' : applies,
        firstTimeOnly: applies === 'first booking',
        gender,
        description: description.trim() || undefined,
      });
      navigate('/promos');
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to save');
    }
  };

  return (
    <form className="stack fade" style={{ maxWidth: 560, gap: 14 }} onSubmit={save}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <Link to="/promos" style={{ fontSize: 13 }}>← Promo codes</Link>
        <h1 className="page-title">Edit {promo.code}</h1>
        {promo.status === 'active' ? <Tag label="Active" cls="tag-green" /> : <Tag label="Paused" cls="" />}
        <div style={{ flex: 1 }} />
        <button type="button" className="btn btn-ghost btn-sm" onClick={toggleStatus}>
          {promo.status === 'active' ? '⏸ Pause code' : '▶ Resume code'}
        </button>
      </div>
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="display" style={{ fontWeight: 700 }}>Discount</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className={`chip ${type === 'percent' ? 'on' : ''}`} onClick={() => setType('percent')}>% Percentage discount</button>
          <button type="button" className={`chip ${type === 'flat' ? 'on' : ''}`} onClick={() => setType('flat')}>₹ Flat discount</button>
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
          label shows as "{promoLabel(type, numValue, type === 'percent' ? numCap : undefined)}"
        </div>
      </div>

      <div className="card" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div className="display" style={{ fontWeight: 700 }}>Scope &amp; audience</div>
        <div className="field">
          <label>Description</label>
          <input className="input" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Shown to staff and on the guest checkout screen" />
        </div>
        <div className="field">
          <label>Applies to</label>
          <select className="input" value={applies} onChange={(e) => setApplies(e.target.value)}>
            <option value="all events">All events</option>
            <option value="first booking">First booking only</option>
            {events.map((e) => (
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
        <div className="tiny hint">usage: {promo.used}/{promo.usageLimit} · checked against verified profile gender at checkout</div>
      </div>

      <div style={{ display: 'flex', gap: 10 }}>
        <button type="submit" className="btn btn-pri" style={{ padding: 10, flex: 1 }}>Save promo code</button>
        <Link to="/promos" className="btn btn-ghost" style={{ padding: 10 }}>Cancel</Link>
      </div>
    </form>
  );
}
