import { useEffect, useMemo, useState } from 'react';
import { CityFilterDropdown, SearchBox } from '../components/ui';
import { liveReviews, liveOrganizers, LiveApiError, type LiveReview, type LiveOrganizer } from '../lib/liveApi';
import { useLiveSession } from '../lib/useLiveSession';
import { useLiveGate, LiveHeaderBar } from '../components/LiveChrome';

const TITLE = 'Reviews';
const Star = ({ n }: { n: number }) => (
  <span style={{ color: 'var(--green)', letterSpacing: 1 }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
);

/** Review moderation — real OrgReview rows (organizer-only; promoters,
 * venues and line-ups have no review model on the backend yet, unlike the
 * mock's 4-role design). Edit/remove are both real (ReviewsService). */
export default function Reviews() {
  const session = useLiveSession();
  const { token } = session;

  const [reviews, setReviews] = useState<LiveReview[]>([]);
  const [organizers, setOrganizers] = useState<LiveOrganizer[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState('');
  const [cityF, setCityF] = useState('All');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editRating, setEditRating] = useState(5);

  const load = () => {
    setLoading(true);
    setErr('');
    Promise.all([liveReviews.list(), liveOrganizers.list()])
      .then(([r, o]) => {
        setReviews(r);
        setOrganizers(o);
      })
      .catch((e) => setErr(e instanceof LiveApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    if (token) load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const cityByOrganizer = useMemo(() => new Map(organizers.map((o) => [o.id, o.city])), [organizers]);
  const cities = useMemo(() => [...new Set(organizers.map((o) => o.city))].sort(), [organizers]);

  const list = useMemo(() => {
    let l = reviews;
    if (cityF !== 'All') l = l.filter((r) => cityByOrganizer.get(r.organizerId) === cityF);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((r) => (r.user.name + r.organizerName + r.text).toLowerCase().includes(q));
    }
    return l;
  }, [reviews, cityF, cityByOrganizer, query]);

  const gate = useLiveGate(TITLE, session);
  if (gate) return gate;

  const avg = list.length ? (list.reduce((a, r) => a + r.rating, 0) / list.length).toFixed(1) : '—';

  const saveEdit = async (id: string) => {
    if (!editText.trim()) { setErr('Review text cannot be empty — remove it instead'); return; }
    try {
      await liveReviews.update(id, { text: editText.trim(), rating: editRating });
      setEditingId(null);
      load();
    } catch (e) {
      setErr(e instanceof LiveApiError ? e.message : 'Failed to save');
    }
  };

  const remove = async (r: LiveReview) => {
    if (!window.confirm(`Remove ${r.user.name}'s review of ${r.organizerName}?`)) return;
    try { await liveReviews.remove(r.id); load(); } catch (e) { setErr(e instanceof LiveApiError ? e.message : 'Failed to remove'); }
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900 }}>
      <LiveHeaderBar title={TITLE} session={session} />
      {err && <div className="card" style={{ borderColor: 'var(--red)', color: 'var(--red)' }}>{err}</div>}
      {loading && <div className="tiny muted">Loading…</div>}

      <div className="page-hd">
        <h1 className="page-title">Reviews</h1>
        <span className="chip">★ {avg} avg · {list.length} shown</span>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>
        moderation is admin-only — organizers see their reviews read-only · edit to redact spam/abuse, remove only when guidelines are broken
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search guest / organizer / text…" style={{ flex: 1, minWidth: 180 }} />
        <CityFilterDropdown value={cityF} onChange={setCityF} cities={cities} />
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {list.map((r) => (
          <div key={r.id} className="card" style={{ padding: 14 }}>
            {editingId === r.id ? (
              <div className="stack" style={{ gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b>{r.user.name || r.user.phone}</b>
                  <span className="muted small">Organizer: {r.organizerName}</span>
                  <select className="input" style={{ width: 70 }} value={editRating} onChange={(e) => setEditRating(+e.target.value)}>
                    {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}★</option>)}
                  </select>
                </div>
                <textarea className="input" style={{ minHeight: 56 }} value={editText} onChange={(e) => setEditText(e.target.value)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button className="btn btn-pri btn-sm" onClick={() => saveEdit(r.id)}>Save ✓</button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5 }}>
                    <b>{r.user.name || r.user.phone}</b> · <Star n={r.rating} /> ·{' '}
                    <span className="muted">Organizer: {r.organizerName} · {new Date(r.createdAt).toLocaleDateString('en-IN')}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>"{r.text}"</div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => { setEditingId(r.id); setEditText(r.text); setEditRating(r.rating); }}
                >
                  ✎ Edit
                </button>
                <button className="btn btn-danger btn-sm" onClick={() => remove(r)}>✕</button>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && !loading && <div className="card muted small">No reviews match.</div>}
      </div>
    </div>
  );
}
