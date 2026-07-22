import { useState } from 'react';
import { useApp } from '../store/AppContext';
import { SEED_REVIEWS } from '../data/mock';
import type { ReviewTargetType } from '../types';
import Stars from './Stars';

/** Guest-facing rating + review list + write-a-review form, shared by every
 * reviewable role (organizer/promoter/venue/lineup) — guests are never
 * reviewable, there's no fifth usage of this component. The headline
 * average is computed live from the actual review list (seed + guest-
 * submitted) rather than a separate static rating field, so it can never
 * drift out of sync with what's actually shown below it. */
export default function ReviewsSection({
  targetType,
  targetId,
  prompt,
}: {
  targetType: ReviewTargetType;
  targetId: string;
  prompt: string;
}) {
  const { user, reviews, addReview, toast } = useApp();
  const key = `${targetType}:${targetId}`;
  const seedMine = SEED_REVIEWS.filter((r) => r.targetType === targetType && r.targetId === targetId);
  const guestMine = reviews[key] ?? [];
  const all = [...guestMine, ...seedMine];
  const avg = all.length ? all.reduce((a, r) => a + r.rating, 0) / all.length : 0;

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
          onSubmit={(rating, text) => {
            if (!user) {
              toast('Log in to write a review');
              return;
            }
            addReview(targetType, targetId, rating, text);
          }}
          prompt={prompt}
        />
        {all.map((r) => (
          <div key={r.id} className="review">
            <span className="bold">{r.author}</span> · <Stars rating={r.rating} /> ·{' '}
            <span className="muted-2">{r.eventTitle ?? r.date}</span>
            <div className="muted">“{r.text}”</div>
          </div>
        ))}
        {all.length === 0 && <div className="tiny muted-2">No reviews yet.</div>}
      </div>
    </section>
  );
}

/** Inline write-a-review form (star pick + text). */
function ReviewForm({ onSubmit, loggedIn, prompt }: { onSubmit: (rating: number, text: string) => void; loggedIn: boolean; prompt: string }) {
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [open, setOpen] = useState(false);
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
        <button className="btn btn-pri btn-sm" disabled={!rating || !text.trim() || !loggedIn}>{loggedIn ? 'Post review' : 'Log in to review'}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
