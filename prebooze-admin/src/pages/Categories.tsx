import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Tag } from '../components/ui';
import { liveCategories, liveEvents, LiveApiError, type LiveCategory } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Categories';

/** Event categories — real EventCategory rows (Event.category stays a plain
 * string, this is just the reference list + each category's own icon/cover/
 * SEO). "Sub-categories" from the mock have no real backing field, dropped
 * here (same reasoning as elsewhere: no fake features with nothing to
 * persist to). */
export default function Categories() {
  const session = useLiveSession();
  const { token } = session;
  const navigate = useNavigate();

  const [categories, setCategories] = useState<LiveCategory[]>([]);
  const [eventCounts, setEventCounts] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveCategories.list(), liveEvents.list()])
      .then(([cats, evs]) => {
        setCategories(cats);
        const counts = new Map<string, number>();
        evs.forEach((e) => counts.set(e.category, (counts.get(e.category) ?? 0) + 1));
        setEventCounts(counts);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const remove = async (c: LiveCategory) => {
    const count = eventCounts.get(c.name) ?? 0;
    if (count > 0) {
      window.alert(`"${c.name}" still has ${count} events — move them first.`);
      return;
    }
    if (!window.confirm(`Remove category "${c.name}"?`)) return;
    try { await liveCategories.remove(c.name); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 700 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Categories</h1>
        <Link to="/categories/new" className="btn btn-pri">+ Add category</Link>
      </div>
      <div className="stack" style={{ gap: 6 }}>
        {categories.map((c) => {
          const count = eventCounts.get(c.name) ?? 0;
          return (
            <button
              key={c.name}
              className="card"
              style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', fontSize: 12.5, cursor: 'pointer', textAlign: 'left', color: 'var(--text)' }}
              onClick={() => navigate(`/categories/${encodeURIComponent(c.name)}/edit`)}
            >
              <span className="muted">⠿</span>
              <span style={{ flex: 1 }}>
                {c.icon} <b>{c.name}</b> · {count} events
                {c.imageUrl && <span className="tiny green"> · cover ✓</span>}
                {c.seo?.title && <span className="tiny green"> · SEO ✓</span>}
              </span>
              {count === 0 ? <Tag label="Hidden" cls="tag-dim" /> : <Tag label="Visible" cls="tag-green" />}
              <span className="muted">✎</span>
              <span
                className="btn btn-danger btn-sm"
                style={{ padding: '2px 7px' }}
                onClick={(e) => { e.stopPropagation(); remove(c); }}
              >
                ✕
              </span>
            </button>
          );
        })}
        {categories.length === 0 && !loading && <div className="card muted small">No categories yet.</div>}
      </div>
      <div className="tiny hint">click a category to edit its icon, cover image and SEO landing page</div>
    </div>
  );
}
