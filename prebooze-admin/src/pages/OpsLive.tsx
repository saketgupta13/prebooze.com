import { useEffect, useState } from 'react';
import { liveCategories, livePromos, liveReels, liveReviews, LiveApiError } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Categories, promos, reels & reviews (live)';
type Kind = 'categories' | 'promos' | 'reels' | 'reviews';
const KINDS: { key: Kind; label: string }[] = [
  { key: 'categories', label: 'Categories' },
  { key: 'promos', label: 'Promo codes' },
  { key: 'reels', label: 'Reels' },
  { key: 'reviews', label: 'Reviews' },
];

/** Four smaller, independent real CMS/ops slices sharing one page. Reviews
 * is view + remove only (moderation) — there's no real "edit someone else's
 * review text" action worth building. */
export default function OpsLive() {
  const session = useLiveSession();
  const { token } = session;
  const [kind, setKind] = useState<Kind>('categories');
  const [rows, setRows] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [form, setForm] = useState<Record<string, string>>({});

  const load = (k: Kind) => {
    setLoading(true);
    setErr('');
    setRows([]); // avoid a frame where `rows` still holds the previous kind's shape
    const api = { categories: liveCategories, promos: livePromos, reels: liveReels, reviews: liveReviews }[k];
    api
      .list()
      .then(setRows)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) { load(kind); setForm({}); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, kind]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const f = (key: string) => form[key] ?? '';
  const setF = (key: string) => (v: string) => setForm((p) => ({ ...p, [key]: v }));

  const create = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    try {
      if (kind === 'categories') await liveCategories.add(f('name'), f('icon') || undefined);
      else if (kind === 'promos') await livePromos.create({ code: f('code'), type: (f('type') as 'percent' | 'flat') || 'percent', value: parseFloat(f('value')) || 10 });
      else if (kind === 'reels') await liveReels.create({ title: f('title'), videoUrl: f('videoUrl') || undefined });
      setForm({});
      load(kind);
    } catch (e2) {
      setErr(e2 instanceof LiveApiError ? e2.message : 'Failed to create');
    }
  };

  const remove = async (id: string) => {
    if (!window.confirm('Remove this?')) return;
    try {
      if (kind === 'categories') await liveCategories.remove(id);
      else if (kind === 'promos') await livePromos.remove(id);
      else if (kind === 'reels') await liveReels.remove(id);
      else await liveReviews.remove(id);
      load(kind);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to remove');
    }
  };

  const togglePromo = async (p: { code: string; status: string }) => {
    try {
      await livePromos.update(p.code, { status: p.status === 'active' ? 'paused' : 'active' });
      load(kind);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update');
    }
  };

  const toggleReel = async (id: string) => {
    try {
      await liveReels.toggle(id);
      load(kind);
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to update');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="tabs">
        {KINDS.map((k) => (
          <button key={k.key} className={kind === k.key ? 'on' : ''} onClick={() => { setRows([]); setKind(k.key); }}>{k.label}</button>
        ))}
      </div>

      {kind !== 'reviews' && (
        <form className="card" style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }} onSubmit={create}>
          {kind === 'categories' && (
            <>
              <div className="field" style={{ flex: 1, minWidth: 140 }}><label>Name</label><input className="input" value={f('name')} onChange={(e) => setF('name')(e.target.value)} /></div>
              <div className="field" style={{ width: 100 }}><label>Icon</label><input className="input" value={f('icon')} onChange={(e) => setF('icon')(e.target.value)} placeholder="🎵" /></div>
            </>
          )}
          {kind === 'promos' && (
            <>
              <div className="field" style={{ width: 140 }}><label>Code</label><input className="input" value={f('code')} onChange={(e) => setF('code')(e.target.value.toUpperCase())} /></div>
              <div className="field" style={{ width: 110 }}>
                <label>Type</label>
                <select className="input" value={f('type') || 'percent'} onChange={(e) => setF('type')(e.target.value)}>
                  <option value="percent">% off</option>
                  <option value="flat">₹ flat</option>
                </select>
              </div>
              <div className="field" style={{ width: 100 }}><label>Value</label><input className="input" inputMode="numeric" value={f('value') || '10'} onChange={(e) => setF('value')(e.target.value)} /></div>
            </>
          )}
          {kind === 'reels' && (
            <>
              <div className="field" style={{ flex: 1, minWidth: 140 }}><label>Title</label><input className="input" value={f('title')} onChange={(e) => setF('title')(e.target.value)} /></div>
              <div className="field" style={{ flex: 1, minWidth: 180 }}><label>Video URL</label><input className="input" value={f('videoUrl')} onChange={(e) => setF('videoUrl')(e.target.value)} /></div>
            </>
          )}
          <button type="submit" className="btn btn-pri">+ Add</button>
        </form>
      )}

      <div className="tblwrap">
        {rows.length === 0 && !loading && <div className="trow muted">Nothing here yet.</div>}
        {kind === 'categories' && (rows as { name: string; icon: string; imageUrl: string | null }[]).map((c) => (
          <div key={c.name} className="trow">
            <span style={{ flex: 1.6, fontWeight: 700 }}>{c.icon} {c.name}</span>
            <span style={{ flex: 0.3, display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-danger btn-sm" onClick={() => remove(c.name)}>✕</button></span>
          </div>
        ))}
        {kind === 'promos' && (rows as { id: string; code: string; type: string; value: number; status: string; usageLimit: number | null }[]).map((p) => (
          <div key={p.id} className="trow">
            <span style={{ flex: 1, fontWeight: 700 }}>{p.code}</span>
            <span style={{ flex: 1 }} className="muted">{p.type === 'percent' ? `${p.value}% off` : `₹${p.value} off`}</span>
            <span style={{ flex: 0.8 }}><button className="btn btn-ghost btn-sm" onClick={() => togglePromo(p)}><span className={`tag ${p.status === 'active' ? 'tag-green' : ''}`}>{p.status}</span></button></span>
            <span style={{ flex: 0.3, display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-danger btn-sm" onClick={() => remove(p.code)}>✕</button></span>
          </div>
        ))}
        {kind === 'reels' && (rows as { id: string; title: string; active: boolean }[]).map((r) => (
          <div key={r.id} className="trow">
            <span style={{ flex: 1.6, fontWeight: 700 }}>{r.title}</span>
            <span style={{ flex: 0.8 }}><button className="btn btn-ghost btn-sm" onClick={() => toggleReel(r.id)}>{r.active ? 'Active ✓' : 'Inactive'}</button></span>
            <span style={{ flex: 0.3, display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>✕</button></span>
          </div>
        ))}
        {kind === 'reviews' && (rows as { id: string; rating: number; text: string; user: { name: string } }[]).map((r) => (
          <div key={r.id} className="trow">
            <span style={{ flex: 2 }}>
              <div style={{ fontWeight: 700 }}>{r.user.name} · {'★'.repeat(r.rating)}</div>
              <div className="tiny muted">{r.text}</div>
            </span>
            <span style={{ flex: 0.3, display: 'flex', justifyContent: 'flex-end' }}><button className="btn btn-danger btn-sm" onClick={() => remove(r.id)}>✕</button></span>
          </div>
        ))}
      </div>
    </div>
  );
}
