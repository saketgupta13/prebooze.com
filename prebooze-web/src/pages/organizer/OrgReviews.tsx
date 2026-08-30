import { useEffect, useState } from 'react';
import { organizer, social } from '../../api';
import { ApiError } from '../../api/client';
import Stars from '../../components/Stars';
import Loader from '../../components/Loader';
import type { GuestReview } from '../../store/AppContext';
import { X, Star, User } from 'lucide-react';

/** Real reviews — GET /organizers/:id/reviews (view-only; moderation is
 * admin-only, same boundary the old mock already described). */
export default function OrgReviews() {
  const [reviews, setReviews] = useState<GuestReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    organizer
      .me()
      .then((org) => social.organizerReviews(org.id))
      .then(setReviews)
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load reviews'))
      .finally(() => setLoading(false));
  }, []);

  const avg = reviews.length ? reviews.reduce((a, r) => a + r.rating, 0) / reviews.length : 0;
  const fiveStarShare = reviews.length ? Math.round((reviews.filter((r) => r.rating === 5).length / reviews.length) * 100) : 0;

  if (loading) return <Loader />;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>Reviews</h1>
      <div className="muted small" style={{ marginBottom: 18 }}>
        what guests said after your events — reviews are moderated by Prebooze and can't be edited or removed by organizers
      </div>
      {err && <div className="danger-text small" style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 6 }}><X size={14} /> {err}</div>}

      <div className="kpis" style={{ marginBottom: 18 }}>
        <div className="kpi"><div className="l">Average rating</div><div className="v" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><Star size={16} /> {avg.toFixed(1)}</div></div>
        <div className="kpi"><div className="l">Total reviews</div><div className="v">{reviews.length}</div></div>
        <div className="kpi"><div className="l">5-star share</div><div className="v accent">{fiveStarShare}%</div></div>
      </div>

      <div className="card">
        {reviews.length === 0 && <div className="muted small">No reviews yet.</div>}
        {reviews.map((r) => (
          <div key={r.id} className="review" style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <span className="avatar" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><User size={16} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div>
                <span className="bold">{r.author}</span> · <Stars rating={r.rating} /> ·{' '}
                <span className="muted-2 small">{r.eventTitle} · {r.date}</span>
              </div>
              <div className="muted">"{r.text}"</div>
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
