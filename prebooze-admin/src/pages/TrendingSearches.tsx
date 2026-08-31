import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { liveTrending, LiveApiError, type LiveTrendingTerm } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Trending searches';

/** Pinned trending search terms — always shown first, in this order, on
 * the guest site's search dropdown ("🔥 TRENDING" when the box is empty).
 * CatalogService.trending() auto-fills any remaining slots (up to 8 total)
 * from real upcoming event titles, so an empty list here isn't a broken
 * state — it just means the whole row is auto-detected. Pin a term here
 * when you want to guarantee/promote something regardless of what's
 * currently trending on its own. */
export default function TrendingSearches() {
  const session = useLiveSession();
  const { token } = session;

  const [terms, setTerms] = useState<LiveTrendingTerm[]>([]);
  const [custom, setCustom] = useState('');
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    liveTrending.list()
      .then(setTerms)
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const add = async () => {
    const t = custom.trim();
    if (!t) return;
    try {
      await liveTrending.add(t);
      setCustom('');
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to add');
    }
  };

  const remove = async (term: string) => {
    if (!window.confirm(`Unpin "${term}"?`)) return;
    try { await liveTrending.remove(term); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  const move = async (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= terms.length) return;
    const a = terms[i], b = terms[j];
    try {
      await Promise.all([liveTrending.reorder(a.term, b.sort), liveTrending.reorder(b.term, a.sort)]);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to reorder');
    }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 560 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Trending searches</h1>
      </div>
      <div className="tiny hint" style={{ marginBottom: 10 }}>
        Pinned terms below always show first, in this order. Any remaining slots (up to 8 total shown
        on the guest site) are filled automatically from words appearing in multiple upcoming event
        titles — pin something here only when you want to guarantee or promote it.
      </div>

      <div className="card stack" style={{ gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            className="input"
            style={{ flex: 1 }}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            placeholder="add a term to pin…"
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } }}
          />
          <button type="button" className="btn btn-pri btn-sm" onClick={add}>+ Pin</button>
        </div>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        {terms.map((t, i) => (
          <div key={t.term} className="card" style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', fontSize: 12.5 }}>
            <span style={{ flex: 1 }}><b>{t.term}</b></span>
            <button type="button" className="btn btn-ghost btn-sm" disabled={i === 0} onClick={() => move(i, -1)} title="Move up">↑</button>
            <button type="button" className="btn btn-ghost btn-sm" disabled={i === terms.length - 1} onClick={() => move(i, 1)} title="Move down">↓</button>
            <span className="btn btn-danger btn-sm" style={{ padding: '2px 7px', cursor: 'pointer', display: 'inline-flex', alignItems: 'center' }} onClick={() => remove(t.term)}><X size={13} /></span>
          </div>
        ))}
        {terms.length === 0 && !loading && (
          <div className="card muted small">No pinned terms — the search dropdown is fully auto-detected right now.</div>
        )}
      </div>
    </div>
  );
}
