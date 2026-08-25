import { useEffect, useState } from 'react';
import { useApp } from '../store/AppContext';
import { SEED_REVIEWS } from '../data/mock';
import { socialReviews, type OrgReview, type VenueReview } from '../api';
import { isBackendEnabled, ApiError } from '../api/client';
import type { ReviewTargetType } from '../types';
import Stars from './Stars';

/** Guest-facing rating + review list + write-a-review form, shared by every
 * reviewable role (organizer/promoter/venue/lineup) — guests are never
 * reviewable, there's no fifth usage of this component. Organizer and venue
 * reviews are real (GET/POST /organizers|venues/:id/reviews, OrgReview/
 * VenueReview models) — promoter/lineup have no equivalent backend yet, so
 * those two stay on the local mock (AppContext.addReview). */
export default function ReviewsSection({
  targetType,
  targetId,
  prompt,
  preselectedEventId,
  preselectedEventTitle,
}: {
  targetType: ReviewTargetType;
  targetId: string;
  prompt: string;
  /** From a review-reminder deep link (?event=<id>) — scopes the write-a-review
   * form to that specific event instead of a generic organizer-wide review.
   * Organizer-only for now; venue/promoter/lineup have no such reminder yet. */
  preselectedEventId?: string;
  preselectedEventTitle?: string;
}) {
  const { user, reviews, addReview, toast } = useApp();
  const isRealTarget = (targetType === 'organizer' || targetType === 'venue') && isBackendEnabled();

  const [liveReviews, setLiveReviews] = useState<(OrgReview | VenueReview)[] | null>(null);
  const [posting, setPosting] = useState(false);
  useEffect(() => {
    if (!isRealTarget) return;
    const fetcher = targetType === 'venue' ? socialReviews.venue : socialReviews.organizer;
    fetcher(targetId).then(setLiveReviews).catch(() => setLiveReviews([]));
  }, [isRealTarget, targetType, targetId]);

  const key = `${targetType}:${targetId}`;
  const seedMine = SEED_REVIEWS.filter((r) => r.targetType === targetType && r.targetId === targetId);
  const guestMine = reviews[key] ?? [];
  const all = isRealTarget ? (liveReviews ?? []) : [...guestMine, ...seedMine];
  const avg = all.length ? all.reduce((a, r) => a + r.rating, 0) / all.length : 0;

  const submit = async (rating: number, text: string) => {
    if (!user) {
      toast('Log in to write a review');
      return;
    }
    if (!isRealTarget) {
      addReview(targetType, targetId, rating, text);
      return;
    }
    setPosting(true);
    try {
      const created = targetType === 'venue'
        ? await socialReviews.addVenueReview(targetId, rating, text)
        : await socialReviews.addOrganizerReview(targetId, rating, text, preselectedEventId);
      setLiveReviews((prev) => [created, ...(prev ?? [])]);
      toast('Review posted ✓');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Failed to post review');
    } finally {
      setPosting(false);
    }
  };

  return (
    <section className="section">
      <div className="section-hd">
        <h2>Rating & reviews</h2>
      </div>
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          {all.length > 0 ? (
            <>
              <span style={{ fontSize: 26, fontWeight: 800 }}>{avg.toFixed(1)}</span>
              <Stars rating={avg} />
              <span className="muted small">· {all.length} review{all.length === 1 ? '' : 's'}</span>
            </>
          ) : (
            <span className="muted small">No reviews yet — be the first</span>
          )}
        </div>
        <ReviewForm
          loggedIn={!!user}
          busy={posting}
          onSubmit={submit}
          prompt={prompt}
          autoOpen={!!preselectedEventId}
          scopedEventTitle={preselectedEventTitle}
        />
        {all.map((r) => (
          <div key={r.id} className="review">
            <span className="bold">{r.author}</span> · <Stars rating={r.rating} /> ·{' '}
            <span className="muted-2">{'eventTitle' in r && r.eventTitle ? `${r.eventTitle} · ${r.date}` : r.date}</span>
            <div className="muted">“{r.text}”</div>
          </div>
        ))}
        {all.length === 0 && <div className="tiny muted-2">No reviews yet.</div>}
      </div>
    </section>
  );
}

/** Inline write-a-review form (star pick + text). `autoOpen`/`scopedEventTitle`
 * come from a review-reminder deep link — opens straight to the form and
 * shows which event it's about, instead of a generic organizer-wide review. */
function ReviewForm({
  onSubmit,
  loggedIn,
  busy,
  prompt,
  autoOpen,
  scopedEventTitle,
}: {
  onSubmit: (rating: number, text: string) => void;
  loggedIn: boolean;
  busy?: boolean;
  prompt: string;
  autoOpen?: boolean;
  scopedEventTitle?: string;
}) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(!!autoOpen);
  if (!open) {
    return (
      <button className="btn btn-ghost btn-sm" style={{ marginBottom: 12 }} onClick={() => setOpen(true)}>
        ✍ Write a review
      </button>
    );
  }
  return (
    <form
      className="dashed-box"
      style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 12, marginBottom: 14 }}
      onSubmit={(e) => {
        e.preventDefault();
        if (!rating || !text.trim()) return;
        onSubmit(rating, text.trim());
        setOpen(false);
        setRating(0);
        setText('');
      }}
    >
      {autoOpen && (
        <div className="tiny muted" style={{ marginBottom: 8 }}>
          Reviewing{scopedEventTitle ? <>: <b>{scopedEventTitle}</b></> : ' the event you attended'}
        </div>
      )}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} type="button" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 22, filter: n <= rating ? 'none' : 'grayscale(1) opacity(.45)' }} onClick={() => setRating(n)} aria-label={`${n} star`}>
            ⭐
          </button>
        ))}
        <span className="tiny muted-2" style={{ alignSelf: 'center' }}>{rating ? `${rating}/5` : 'pick a rating'}</span>
      </div>
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={prompt} style={{ marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-pri btn-sm" disabled={!rating || !text.trim() || !loggedIn || busy}>{!loggedIn ? 'Log in to review' : busy ? 'Posting…' : 'Post review'}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
