import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import {
  EVENTS,
  PROMOTERS,
  REVIEWS,
  lineupByName,
  eventBySlug,
  fmtDate,
  fmtTime,
  organizerById,
  venueById,
} from '../data/mock';
import { friendsGoing, goingCount, myStatus } from '../lib/social';
import Poster, { categoryEmoji } from '../components/Poster';
import Accordion from '../components/Accordion';
import Stars from '../components/Stars';
import Stepper from '../components/Stepper';
import EventCard from '../components/EventCard';

export default function EventDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, city, setSelection, myEvents, following, bookings, interested, toggleInterested, pendingPromoterRef, setPendingPromoterRef } = useApp();
  const event = eventBySlug(slug ?? '') ?? myEvents.find((e) => e.slug === slug);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState(false);

  // Credit a promoter for any purchase made through their shared link (?ref=slug).
  const ref = params.get('ref');
  useEffect(() => {
    if (ref) setPendingPromoterRef(ref);
  }, [ref, setPendingPromoterRef]);
  const refPromoter = PROMOTERS.find((p) => p.slug === (ref ?? pendingPromoterRef));

  const total = useMemo(() => {
    if (!event) return 0;
    return event.tiers.reduce((sum, t) => sum + (qty[t.id] ?? 0) * t.price, 0);
  }, [qty, event]);

  if (!event) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Event not found</h1>
          <p className="muted" style={{ margin: '10px 0 20px' }}>
            It may have ended or been unpublished.
          </p>
          <Link to="/browse" className="btn btn-pri">
            Browse events
          </Link>
        </div>
      </main>
    );
  }

  const venue = venueById(event.venueId);
  const organizer = organizerById(event.organizerId);
  const ticketCount = Object.values(qty).reduce((a, b) => a + b, 0);
  const recommended = EVENTS.filter((e) => e.status === 'approved' && e.id !== event.id).slice(0, 4);

  const going = goingCount(event);
  const friends = friendsGoing(event.id, following);
  const status = myStatus(event.id, bookings, interested);
  const friendLabel = (() => {
    if (friends.length === 0) return '';
    const names = friends.map((f) => f.person.name.split(' ')[0]);
    const head = names.slice(0, 2).join(', ');
    const extra = friends.length > 2 ? ` +${friends.length - 2}` : '';
    const verb = friends.every((f) => f.status === 'going')
      ? 'going'
      : friends.every((f) => f.status === 'interested')
        ? 'interested'
        : 'in';
    return `${head}${extra} you follow ${friends.length === 1 ? 'is' : 'are'} ${verb}`;
  })();

  const book = () => {
    setSelection({ eventId: event.id, qty });
    if (!user) {
      navigate('/login', { state: { from: '/checkout' } });
    } else {
      navigate('/checkout');
    }
  };

  return (
    <main className="page">
      <div className="container">
        <div className="breadcrumb">
          <Link to="/browse">Events</Link> / {event.title}
        </div>

        <div className="detail-grid">
          <div>
            {/* Head */}
            <div className="detail-head">
              <Poster hue={event.posterHue} emoji={categoryEmoji(event.category)} label="portrait banner 3:4" />
              <div className="detail-title">
                <h1>{event.title}</h1>
                <div className="detail-meta">
                  <span>📅 {fmtDate(event.date)}, {fmtTime(event.date)}</span>
                  <span>📍 {venue.name}, {venue.city}</span>
                  <span>⏱ {event.durationHrs} hrs</span>
                </div>
                <div className="chip-row">
                  {event.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                </div>

                {/* Hosted by + who's going — fills the space under the title */}
                <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                  <Link
                    to={`/organizers/${organizer.id}`}
                    className="evrow"
                    style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}
                  >
                    <span style={{ width: 34, height: 34, borderRadius: '50%', background: `hsl(${organizer.logoHue} 55% 45%)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎧</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="tiny muted-2">Hosted by</div>
                      <div className="bold small">
                        {organizer.brandName} {organizer.verified && <span className="verified">✓</span>}{' '}
                        <span className="muted" style={{ fontWeight: 400 }}>· ★ {organizer.rating}</span>
                      </div>
                    </div>
                    <span className="link small">View →</span>
                  </Link>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                    {friends.length > 0 && (
                      <div style={{ display: 'flex' }}>
                        {friends.slice(0, 4).map((fr, i) => (
                          <Link key={fr.person.id} to={`/u/${fr.person.username}`} title={fr.person.name} style={{ width: 28, height: 28, borderRadius: '50%', background: `hsl(${fr.person.avatarHue} 55% 45%)`, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 12, marginLeft: i ? -8 : 0, border: '2px solid var(--bg)', textDecoration: 'none' }}>
                            {fr.person.name[0]}
                          </Link>
                        ))}
                      </div>
                    )}
                    <div style={{ minWidth: 0 }}>
                      <div className="bold small">{going.toLocaleString('en-IN')} going</div>
                      <div className="tiny muted-2">{friends.length > 0 ? friendLabel : 'Be the first of your friends to go 👀'}</div>
                    </div>
                    <div style={{ flex: 1 }} />
                    {status === 'going' ? (
                      <span className="badge badge-accent">You're going ✓</span>
                    ) : (
                      <button className={`btn btn-sm ${status === 'interested' ? 'btn-pri' : 'btn-ghost'}`} onClick={() => toggleInterested(event.id)}>
                        {status === 'interested' ? '★ Interested' : '☆ Interested'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* About */}
            <section className="section" style={{ marginTop: 0 }}>
              <div className="section-hd">
                <h2>About this event</h2>
              </div>
              <p className="muted" style={{ fontSize: 14 }}>
                {expanded || event.description.length <= 220
                  ? event.description
                  : event.description.slice(0, 220) + '…'}
              </p>
              {event.description.length > 220 && (
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setExpanded((e) => !e)}>
                  {expanded ? 'Show less ▴' : 'Read more ▾'}
                </button>
              )}
            </section>

            {/* Conditions */}
            {event.conditions.length > 0 && (
              <section className="section">
                <div className="section-hd">
                  <h2>Event conditions</h2>
                </div>
                <ul style={{ paddingLeft: 20, color: 'var(--muted)', fontSize: 14, display: 'grid', gap: 6 }}>
                  {event.conditions.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
              </section>
            )}

            {/* Party rules */}
            {event.rules.length > 0 && (
              <section className="section">
                <div className="section-hd">
                  <h2>Party rules</h2>
                </div>
                {event.rules.map((r, i) => (
                  <Accordion key={r.title} title={r.title} defaultOpen={i === 0}>
                    {r.body}
                  </Accordion>
                ))}
              </section>
            )}

            {/* Lineup */}
            {event.lineup.length > 0 && (
              <section className="section">
                <div className="section-hd">
                  <h2>Line-up & partners</h2>
                </div>
                <div className="lineup">
                  {event.lineup.map((l) => {
                    const profile = lineupByName(l.name);
                    const inner = (
                      <>
                        <span className="avatar">{profile?.emoji ?? (l.role.includes('DJ') || l.role.includes('artist') ? '🎤' : '🏷')}</span>
                        <span className="who">
                          <span className="n" style={{ display: 'block' }}>
                            {l.name} {profile?.verified && <span className="verified">✓</span>}
                          </span>
                          <span className="r">{l.role}{profile ? ' · view profile →' : ''}</span>
                        </span>
                      </>
                    );
                    return profile ? (
                      <Link key={l.name} to={`/lineup/${profile.slug}`} className="lineup-item" style={{ borderColor: 'var(--border-3)' }}>
                        {inner}
                      </Link>
                    ) : (
                      <div key={l.name} className="lineup-item">{inner}</div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Reviews */}
            <section className="section">
              <div className="section-hd">
                <h2>Organizer rating & reviews</h2>
              </div>
              <div className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
                  <span style={{ fontSize: 26, fontWeight: 800 }}>{organizer.rating}</span>
                  <Stars rating={organizer.rating} />
                  <span className="muted small">
                    · {organizer.reviewCount} reviews of {organizer.brandName}
                  </span>
                </div>
                {REVIEWS.slice(0, 2).map((r) => (
                  <div key={r.id} className="review">
                    <span className="bold">{r.author}</span> · <Stars rating={r.rating} /> ·{' '}
                    <span className="muted-2">{r.eventTitle}</span>
                    <div className="muted">“{r.text}”</div>
                  </div>
                ))}
                <Link to={`/organizers/${organizer.id}`} className="link small bold">
                  Read all reviews →
                </Link>
              </div>
            </section>
          </div>

          {/* Sticky ticket selector */}
          <aside className="ticket-box card card-shadow">
            {refPromoter && (
              <div className="dashed-box" style={{ border: '1.5px dashed var(--accent)', borderRadius: 10, padding: '8px 10px', fontSize: 12, marginBottom: 12 }}>
                📣 Referred by <b>{refPromoter.name}</b> — they’ll be credited for your booking.
              </div>
            )}
            <h3 style={{ marginBottom: 6 }}>Select tickets</h3>
            {event.tiers.map((t) => {
              const left = t.quantity - t.sold;
              const soldOut = left <= 0;
              return (
                <div key={t.id} className="tier-row">
                  <div className="tier-info">
                    <div className="name">
                      {t.name} — ₹{t.price}
                      {!soldOut && left <= 25 && (
                        <span className="danger-text tiny"> · {left} left</span>
                      )}
                    </div>
                    {t.includes.length > 0 && (
                      <div className="includes">✓ {t.includes.join(' · ✓ ')}</div>
                    )}
                    {t.description && <div className="includes" style={{ marginTop: 2 }}>{t.description}</div>}
                  </div>
                  {soldOut ? (
                    <span className="badge badge-danger">sold out</span>
                  ) : (
                    <Stepper
                      value={qty[t.id] ?? 0}
                      onChange={(v) => setQty((q) => ({ ...q, [t.id]: v }))}
                      max={Math.min(10, left)}
                    />
                  )}
                </div>
              );
            })}
            <div className="total-row">
              <span>Total</span>
              <span>₹{total}</span>
            </div>
            <button className="btn btn-pri btn-block btn-lg" disabled={ticketCount === 0} onClick={book}>
              {ticketCount === 0
                ? 'Select tickets'
                : `Book ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} →`}
            </button>
            {status !== 'going' && (
              <button
                className={`btn btn-block btn-sm ${status === 'interested' ? 'btn-pri' : 'btn-ghost'}`}
                style={{ marginTop: 8 }}
                onClick={() => toggleInterested(event.id)}
              >
                {status === 'interested' ? '★ Interested — saved' : '☆ Interested'}
              </button>
            )}
            <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
              🔒 secure checkout · free cancellation up to 48h
            </div>
          </aside>
        </div>

        {/* Recommended */}
        <section className="section">
          <div className="section-hd">
            <h2>Recommended events in {city}</h2>
            <Link to="/browse">See all →</Link>
          </div>
          <div className="grid-4">
            {recommended.map((e) => (
              <EventCard key={e.id} event={e} />
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
