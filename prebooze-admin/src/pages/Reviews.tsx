import { useMemo, useState } from 'react';
import { useAdmin } from '../store/AdminContext';
import { SearchBox } from '../components/ui';

const Star = ({ n }: { n: number }) => (
  <span style={{ color: 'var(--green)', letterSpacing: 1 }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
);

/** Review moderation — admin sees every organizer's reviews and can edit or remove them.
 * Organizers only ever get a read-only view on their side. */
export default function Reviews() {
  const { reviews, updateReview, removeReview, toast } = useAdmin();
  const [org, setOrg] = useState('All');
  const [query, setQuery] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editRating, setEditRating] = useState(5);

  const organizers = ['All', ...new Set(reviews.map((r) => r.organizer))];
  const list = useMemo(() => {
    let l = reviews;
    if (org !== 'All') l = l.filter((r) => r.organizer === org);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((r) => (r.author + r.eventTitle + r.text).toLowerCase().includes(q));
    }
    return l;
  }, [reviews, org, query]);

  const avg = list.length ? (list.reduce((a, r) => a + r.rating, 0) / list.length).toFixed(1) : '—';

  return (
    <div className="stack fade" style={{ maxWidth: 900 }}>
      <div className="page-hd">
        <h1 className="page-title">Reviews</h1>
        <span className="chip">★ {avg} avg · {list.length} shown</span>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>
        moderation is admin-only — organizers see their reviews read-only · edit to redact spam/abuse, remove only when guidelines are broken
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search author / event / text…" style={{ flex: 1, minWidth: 180 }} />
        {organizers.map((o) => (
          <button key={o} className={`chip ${org === o ? 'on' : ''}`} onClick={() => setOrg(o)}>{o}</button>
        ))}
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {list.map((r) => (
          <div key={r.id} className="card" style={{ padding: 14 }}>
            {editingId === r.id ? (
              <div className="stack" style={{ gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b>{r.author}</b>
                  <span className="muted small">{r.eventTitle} · {r.organizer}</span>
                  <select className="input" style={{ width: 70 }} value={editRating} onChange={(e) => setEditRating(+e.target.value)}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <option key={n} value={n}>{n}★</option>
                    ))}
                  </select>
                </div>
                <textarea className="input" style={{ minHeight: 56 }} value={editText} onChange={(e) => setEditText(e.target.value)} />
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    className="btn btn-pri btn-sm"
                    onClick={() => {
                      if (!editText.trim()) {
                        toast('Review text cannot be empty — remove it instead');
                        return;
                      }
                      updateReview(r.id, { text: editText.trim(), rating: editRating });
                      setEditingId(null);
                    }}
                  >
                    Save ✓
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={() => setEditingId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5 }}>
                    <b>{r.author}</b> · <Star n={r.rating} /> ·{' '}
                    <span className="muted">{r.eventTitle} · {r.organizer} · {r.date}</span>
                  </div>
                  <div className="muted" style={{ fontSize: 12.5, marginTop: 3 }}>“{r.text}”</div>
                </div>
                <button
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    setEditingId(r.id);
                    setEditText(r.text);
                    setEditRating(r.rating);
                  }}
                >
                  ✎ Edit
                </button>
                <button
                  className="btn btn-danger btn-sm"
                  onClick={() => {
                    if (window.confirm(`Remove ${r.author}'s review of ${r.eventTitle}?`)) removeReview(r.id);
                  }}
                >
                  ✕
                </button>
              </div>
            )}
          </div>
        ))}
        {list.length === 0 && <div className="card muted small">No reviews match.</div>}
      </div>
    </div>
  );
}
