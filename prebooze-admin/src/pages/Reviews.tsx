import { useMemo, useState } from 'react';
import { useAdmin } from '../store/AdminContext';
import { CityFilterDropdown, SearchBox } from '../components/ui';
import { enabledCityNames } from '../store/data';
import type { ReviewTargetType } from '../types';

const Star = ({ n }: { n: number }) => (
  <span style={{ color: 'var(--green)', letterSpacing: 1 }}>{'★'.repeat(n)}{'☆'.repeat(5 - n)}</span>
);

const TYPE_LABEL: Record<ReviewTargetType, string> = {
  organizer: 'Organizer',
  promoter: 'Promoter',
  venue: 'Venue',
  lineup: 'Line-up',
};

const TYPES: ReviewTargetType[] = ['organizer', 'promoter', 'venue', 'lineup'];

/** Review moderation — admin sees every organizer/promoter/venue/line-up's
 * reviews and can add, edit or remove them. Those roles only ever get a
 * read-only view on their side. Guests are never reviewable. */
export default function Reviews() {
  const { reviews, addReview, updateReview, removeReview, toast, organizers, promoters, venues, lineups, locations } = useAdmin();
  const [type, setType] = useState<'All' | ReviewTargetType>('All');
  const [cityF, setCityF] = useState('All');
  const [query, setQuery] = useState('');
  const cities = enabledCityNames(locations);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [editRating, setEditRating] = useState(5);

  const [adding, setAdding] = useState(false);
  const [nAuthor, setNAuthor] = useState('');
  const [nEventTitle, setNEventTitle] = useState('');
  const [nType, setNType] = useState<ReviewTargetType>('organizer');
  const [nTarget, setNTarget] = useState('');
  const [nRating, setNRating] = useState(5);
  const [nText, setNText] = useState('');

  const targetOptions: Record<ReviewTargetType, string[]> = {
    organizer: organizers.map((o) => o.name),
    promoter: promoters.map((p) => p.name),
    venue: venues.map((v) => v.name),
    lineup: lineups.map((l) => l.name),
  };

  // Reviews only store targetType/targetName, not city — resolve it live from
  // each role's own directory so the filter always reflects real city data
  // (never goes stale if a business moves city or gets renamed).
  const cityByTarget = useMemo(() => {
    const m = new Map<string, string>();
    organizers.forEach((o) => m.set(`organizer:${o.name}`, o.city));
    promoters.forEach((p) => m.set(`promoter:${p.name}`, p.city));
    venues.forEach((v) => m.set(`venue:${v.name}`, v.city));
    lineups.forEach((l) => l.city && m.set(`lineup:${l.name}`, l.city));
    return m;
  }, [organizers, promoters, venues, lineups]);

  const list = useMemo(() => {
    let l = reviews;
    if (type !== 'All') l = l.filter((r) => r.targetType === type);
    if (cityF !== 'All') l = l.filter((r) => cityByTarget.get(`${r.targetType}:${r.targetName}`) === cityF);
    if (query.trim()) {
      const q = query.toLowerCase();
      l = l.filter((r) => (r.author + r.eventTitle + r.targetName + r.text).toLowerCase().includes(q));
    }
    return l;
  }, [reviews, type, cityF, cityByTarget, query]);

  const avg = list.length ? (list.reduce((a, r) => a + r.rating, 0) / list.length).toFixed(1) : '—';

  const resetAddForm = () => {
    setNAuthor('');
    setNEventTitle('');
    setNType('organizer');
    setNTarget('');
    setNRating(5);
    setNText('');
    setAdding(false);
  };

  const submitAdd = () => {
    if (!nAuthor.trim() || !nTarget.trim() || !nText.trim()) {
      toast('Fill author, target and review text');
      return;
    }
    addReview({
      author: nAuthor.trim(),
      rating: nRating,
      eventTitle: nEventTitle.trim(),
      targetType: nType,
      targetName: nTarget.trim(),
      text: nText.trim(),
      date: new Date().toISOString().slice(0, 10),
    });
    resetAddForm();
  };

  return (
    <div className="stack fade" style={{ maxWidth: 900 }}>
      <div className="page-hd">
        <h1 className="page-title">Reviews</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span className="chip">★ {avg} avg · {list.length} shown</span>
          <button className="btn btn-pri btn-sm" onClick={() => setAdding((v) => !v)}>
            {adding ? 'Cancel' : '+ Add review'}
          </button>
        </div>
      </div>
      <div className="tiny hint" style={{ marginTop: -6 }}>
        moderation is admin-only — organizers/promoters/venues/line-ups see their reviews read-only · edit to redact spam/abuse, remove only when guidelines are broken
      </div>

      {adding && (
        <div className="card stack" style={{ gap: 8, padding: 14 }}>
          <div className="display" style={{ fontWeight: 700 }}>New review</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Author name" value={nAuthor} onChange={(e) => setNAuthor(e.target.value)} />
            <input className="input" style={{ flex: 1, minWidth: 140 }} placeholder="Event title (optional)" value={nEventTitle} onChange={(e) => setNEventTitle(e.target.value)} />
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <select
              className="input"
              style={{ width: 130 }}
              value={nType}
              onChange={(e) => {
                setNType(e.target.value as ReviewTargetType);
                setNTarget('');
              }}
            >
              {TYPES.map((t) => (
                <option key={t} value={t}>{TYPE_LABEL[t]}</option>
              ))}
            </select>
            <select className="input" style={{ flex: 1, minWidth: 160 }} value={nTarget} onChange={(e) => setNTarget(e.target.value)}>
              <option value="">Select {TYPE_LABEL[nType].toLowerCase()}…</option>
              {targetOptions[nType].map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select className="input" style={{ width: 70 }} value={nRating} onChange={(e) => setNRating(+e.target.value)}>
              {[1, 2, 3, 4, 5].map((n) => (
                <option key={n} value={n}>{n}★</option>
              ))}
            </select>
          </div>
          <textarea className="input" style={{ minHeight: 56 }} placeholder="Review text…" value={nText} onChange={(e) => setNText(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-pri btn-sm" onClick={submitAdd}>Save ✓</button>
            <button className="btn btn-ghost btn-sm" onClick={resetAddForm}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <SearchBox value={query} onChange={setQuery} placeholder="Search author / event / target / text…" style={{ flex: 1, minWidth: 180 }} />
        <button className={`chip ${type === 'All' ? 'on' : ''}`} onClick={() => setType('All')}>All roles</button>
        {TYPES.map((t) => (
          <button key={t} className={`chip ${type === t ? 'on' : ''}`} onClick={() => setType(t)}>{TYPE_LABEL[t]}</button>
        ))}
        <CityFilterDropdown value={cityF} onChange={setCityF} cities={cities} />
      </div>

      <div className="stack" style={{ gap: 8 }}>
        {list.map((r) => (
          <div key={r.id} className="card" style={{ padding: 14 }}>
            {editingId === r.id ? (
              <div className="stack" style={{ gap: 8 }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b>{r.author}</b>
                  <span className="muted small">{r.eventTitle} · {TYPE_LABEL[r.targetType]}: {r.targetName}</span>
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
                    <span className="muted">{r.eventTitle} · {TYPE_LABEL[r.targetType]}: {r.targetName} · {r.date}</span>
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
