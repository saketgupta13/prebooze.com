import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { EVENTS, ORGANIZERS, PAST_EVENTS, REVIEWS } from '../data/mock';
import { friendsAtEvents } from '../lib/social';
import FriendsProof from '../components/FriendsProof';
import ShareButton from '../components/ShareButton';
import Poster from '../components/Poster';
import EventCard from '../components/EventCard';
import Stars from '../components/Stars';

export default function OrganizerProfile() {
  const { id } = useParams();
  const { user, following, toggleFollow, orgReviews, addOrgReview, toast } = useApp();
  const org = ORGANIZERS.find((o) => o.id === id);

  if (!org) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Organizer not found</h1>
          <Link to="/" className="btn btn-pri" style={{ marginTop: 18 }}>
            Home
          </Link>
        </div>
      </main>
    );
  }

  const upcoming = EVENTS.filter((e) => e.organizerId === org.id && e.status === 'approved');
  const isFollowing = following.includes(org.id);
  const friends = friendsAtEvents(upcoming.map((e) => e.id), following);
  const myReviews = orgReviews[org.id] ?? [];

  return (
    <main className="page">
      <div className="container">
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', marginBottom: 22, flexWrap: 'wrap' }}>
          <Poster hue={org.logoHue} emoji="🎧" variant="square" className="" />
          <div style={{ flex: 1, minWidth: 220 }}>
            <h1 style={{ fontSize: 24 }}>
              {org.brandName} {org.verified && <span className="verified">✓</span>}
            </h1>
            <div className="muted small">
              @{org.username} · {org.city} · since {org.since}
            </div>
            <p className="muted small" style={{ marginTop: 6, maxWidth: 480 }}>
              {org.about}
            </p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <span className="icon-round">ig</span>
            <span className="icon-round">x</span>
            <span className="icon-round">🌐</span>
            <button
              className={`btn btn-sm ${isFollowing ? 'btn-ghost' : 'btn-pri'}`}
              onClick={() => toggleFollow(org.id)}
            >
              {isFollowing ? 'Following ✓' : '+ Follow'}
            </button>
            <ShareButton path={`/organizers/${org.id}`} />
          </div>
        </div>

        <FriendsProof people={friends} suffix="going to their events" style={{ marginBottom: 16 }} />

        <div className="profile-grid">
          <div>
            <div className="stat3" style={{ marginBottom: 16 }}>
              <div className="s">
                <div className="v">{(org.followers / 1000).toFixed(1).replace('.0', '')}k</div>
                <div className="l">followers</div>
              </div>
              <div className="s">
                <div className="v">{org.following}</div>
                <div className="l">following</div>
              </div>
              <div className="s">
                <div className="v">{org.eventsHosted}</div>
                <div className="l">events hosted</div>
              </div>
            </div>

            <div className="card">
              <h3 style={{ marginBottom: 8 }}>Verified organizer</h3>
              <div className="kv">
                <span className="k">Identity KYC</span>
                <span className="verified">✓</span>
              </div>
              <div className="kv">
                <span className="k">Bank verified</span>
                <span className="verified">✓</span>
              </div>
              <div className="kv">
                <span className="k">Joined</span>
                <span>Jan {org.since}</span>
              </div>
            </div>
          </div>

          <div>
            <section className="section" style={{ marginTop: 0 }}>
              <div className="section-hd">
                <h2>Upcoming events ({upcoming.length})</h2>
              </div>
              {upcoming.length ? (
                <div className="grid-3">
                  {upcoming.map((e) => (
                    <EventCard key={e.id} event={e} />
                  ))}
                </div>
              ) : (
                <div className="empty">No upcoming events published.</div>
              )}
            </section>

            <section className="section">
              <div className="section-hd">
                <h2>Past events ({org.eventsHosted})</h2>
              </div>
              <div className="grid-3">
                {PAST_EVENTS.slice(0, 6).map((p) => (
                  <div key={p.title} className="ecard">
                    <Poster hue={p.hue} emoji="📸" label="poster" />
                    <div>
                      <h3>{p.title}</h3>
                      <div className="meta">
                        {p.date} · ★ {p.orgRating}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="section">
              <div className="section-hd">
                <h2>Rating & reviews</h2>
              </div>
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 26, fontWeight: 800 }}>{org.rating}</span>
                  <Stars rating={org.rating} />
                  <span className="muted small">· {org.reviewCount + myReviews.length} reviews</span>
                </div>
                <ReviewForm onSubmit={(rating, text) => { if (!user) { toast('Log in to write a review'); return; } addOrgReview(org.id, rating, text); }} loggedIn={!!user} />
                {myReviews.map((r) => (
                  <div key={r.id} className="review">
                    <span className="bold">{r.author}</span> · <Stars rating={r.rating} /> ·{' '}
                    <span className="muted-2">{r.date}</span>
                    <div className="muted">“{r.text}”</div>
                  </div>
                ))}
                {REVIEWS.map((r) => (
                  <div key={r.id} className="review">
                    <span className="bold">{r.author}</span> · <Stars rating={r.rating} /> ·{' '}
                    <span className="muted-2">{r.eventTitle}</span>
                    <div className="muted">“{r.text}”</div>
                  </div>
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </main>
  );
}

/** Inline write-a-review form (star pick + text). */
function ReviewForm({ onSubmit, loggedIn }: { onSubmit: (rating: number, text: string) => void; loggedIn: boolean }) {
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
      <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="How was the event / organizer?" style={{ marginBottom: 8 }} />
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn btn-pri btn-sm" disabled={!rating || !text.trim() || !loggedIn}>{loggedIn ? 'Post review' : 'Log in to review'}</button>
        <button type="button" className="btn btn-ghost btn-sm" onClick={() => setOpen(false)}>Cancel</button>
      </div>
    </form>
  );
}
