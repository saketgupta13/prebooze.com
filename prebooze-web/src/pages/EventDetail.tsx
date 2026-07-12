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
import Poster, { categoryEmoji } from '../components/Poster';
import Accordion from '../components/Accordion';
import Stars from '../components/Stars';
import Stepper from '../components/Stepper';
import EventCard from '../components/EventCard';

export default function EventDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, city, setSelection, myEvents, pendingPromoterRef, setPendingPromoterRef } = useApp();
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

            {/* Hosted by */}
            <div className="host-card">
              <Poster hue={organizer.logoHue} emoji="🎧" variant="square" className="" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="small muted">Hosted by</div>
                <div className="bold">
                  {organizer.brandName} {organizer.verified && <span className="verified">✓</span>}{' '}
                  <span className="muted small">
                    · ★ {organizer.rating} · {organizer.eventsHosted} events hosted
                  </span>
                </div>
              </div>
              <Link to={`/organizers/${organizer.id}`} className="btn btn-ghost btn-sm">
                View organizer profile →
              </Link>
            </div>

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
