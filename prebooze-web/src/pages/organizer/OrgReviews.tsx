import { SEED_REVIEWS } from '../../data/mock';
import { useApp } from '../../store/AppContext';
import Stars from '../../components/Stars';

/** Organizer's reviews — view-only. Moderation (edit/remove) is admin-only. */
export default function OrgReviews() {
  const { reviews } = useApp();
  const seedMine = SEED_REVIEWS.filter((r) => r.targetType === 'organizer' && r.targetId === 'livewire');
  const guestMine = reviews['organizer:livewire'] ?? [];
  const mine = [...guestMine, ...seedMine];
  const avg = mine.length ? mine.reduce((a, r) => a + r.rating, 0) / mine.length : 0;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Reviews</h1>
      <div className="muted small" style={{ marginBottom: 18 }}>
        what guests said after your events — reviews are moderated by Prebooze and can't be edited or removed by organizers
      </div>

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi"><div className="l">Average rating</div><div className="v">★ {avg.toFixed(1)}</div></div>
        <div className="kpi"><div className="l">Total reviews</div><div className="v">{mine.length + 179}</div></div>
        <div className="kpi"><div className="l">5-star share</div><div className="v accent">{Math.round((mine.filter((r) => r.rating === 5).length / Math.max(mine.length, 1)) * 100)}%</div></div>
      </div>

      <div className="card">
        {mine.map((r) => (
          <div key={r.id} className="review" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span className="avatar">👤</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>
                <span className="bold">{r.author}</span> · <Stars rating={r.rating} /> ·{' '}
                <span className="muted-2 small">{r.eventTitle} · {r.date}</span>
              </div>
              <div className="muted">“{r.text}”</div>
            </div>
          </div>
        ))}
      </div>
      <div className="tiny muted-2" style={{ marginTop: 10 }}>
        think a review breaks the guidelines? flag it and the Prebooze team will look — moderation happens in the admin panel
      </div>
    </div>
  );
}
