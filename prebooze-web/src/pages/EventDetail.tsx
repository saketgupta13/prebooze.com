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
import { catalog, social, bookings as bookingsApi } from '../api';
import { isBackendEnabled } from '../api/client';
import type { Event, WaitlistEntry } from '../types';
import type { GuestReview } from '../store/AppContext';
import { friendsGoing, goingCount, myStatus } from '../lib/social';
import { existingRole, roleLabel } from '../lib/roles';
import { stripHtml } from '../lib/richtext';
import { useSeo } from '../lib/useSeo';
import { usePlatformInfo } from '../lib/usePlatformInfo';
import { useIsMobile } from '../lib/useIsMobile';
import Poster, { categoryEmoji } from '../components/Poster';
import { PageLoader } from '../components/Loader';
import Accordion from '../components/Accordion';
import Stars from '../components/Stars';
import Stepper from '../components/Stepper';
import EventCard from '../components/EventCard';
import ShareButton from '../components/ShareButton';

/** Real event + venue + organizer + reviews + recommended, all from the
 * live catalog API — this page used to read purely from the local mock
 * seed (EVENTS/eventBySlug), so a real event created in admin was always
 * "Event not found" here despite existing in the real database. Booking
 * itself (the "Book" button → /checkout) hands off to Checkout.tsx, which
 * is fully real too (real hold→quote→Razorpay→confirm). */
export default function EventDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { user, city, setSelection, myEvents, following, bookings, interested, toggleInterested, pendingPromoterRef, setPendingPromoterRef, waitlists, joinWaitlist } = useApp();
  const { salesPaused } = usePlatformInfo();

  const mockEvent = eventBySlug(slug ?? '') ?? myEvents.find((e) => e.slug === slug);
  const [liveEvent, setLiveEvent] = useState<Event | null>(null);
  const [liveReviews, setLiveReviews] = useState<GuestReview[]>([]);
  const [liveRecommended, setLiveRecommended] = useState<Event[]>([]);
  const [loaded, setLoaded] = useState(!isBackendEnabled());

  useEffect(() => {
    if (!isBackendEnabled() || !slug) return;
    setLoaded(false);
    catalog
      .event(slug)
      .then((e) => {
        setLiveEvent(e);
        if (e.organizerId) social.organizerReviews(e.organizerId).then(setLiveReviews).catch(() => {});
        catalog.events({ city }).then((all) => setLiveRecommended(all.filter((x) => x.id !== e.id).slice(0, 4))).catch(() => {});
      })
      .catch(() => setLiveEvent(null))
      .finally(() => setLoaded(true));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const event = liveEvent ?? mockEvent;
  useSeo(event?.seo, event?.title);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState(false);
  const [ticketBoxOpen, setTicketBoxOpen] = useState(false);
  // Collapsible "single Book ticket button" is a mobile-only pattern — on
  // desktop the ticket box stays exactly what it always was, a normal
  // sticky sidebar showing the full tier list.
  const isMobile = useIsMobile();
  const showFullTicketBox = !isMobile || ticketBoxOpen;

  // Real waitlist queue (GET /events/:id/waitlist — public, shown to
  // logged-out guests too) — was purely local mock state before; refetched
  // right after joining so the count/position the guest sees is real.
  const [liveWaitlist, setLiveWaitlist] = useState<WaitlistEntry[] | null>(null);
  const refetchWaitlist = () => {
    if (!isBackendEnabled() || !event) return;
    bookingsApi.waitlist(event.id).then(setLiveWaitlist).catch(() => {});
  };
  useEffect(() => {
    if (!isBackendEnabled() || !event) return;
    bookingsApi.waitlist(event.id).then(setLiveWaitlist).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

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

  if (!loaded) {
    return <PageLoader />;
  }

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

  const venue = event.venue ?? venueById(event.venueId);
  const organizer = event.organizer ?? organizerById(event.organizerId);
  const ticketCount = Object.values(qty).reduce((a, b) => a + b, 0);
  const minPrice = Math.min(...event.tiers.map((t) => t.price));
  const recommended = liveEvent ? liveRecommended : EVENTS.filter((e) => e.status === 'approved' && e.id !== event.id).slice(0, 4);
  const reviews = liveEvent ? liveReviews : REVIEWS;

  const going = goingCount(event);
  const friends = friendsGoing(event.id, following);
  const allSoldOut = event.tiers.every((t) => t.sold >= t.quantity);
  const queue = liveWaitlist ?? waitlists[event.id] ?? [];
  const myEntry = user ? queue.find((w) => w.phone === user.phone) : undefined;
  const myPosition = myEntry ? queue.filter((w) => w.status === 'waiting').findIndex((w) => w.phone === user?.phone) + 1 : 0;
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
    if (existingRole(user)) return; // business/elevated-role account — checkout also blocks this
    setSelection({ eventId: event.id, eventSlug: liveEvent ? event.slug : undefined, qty });
    if (!user) {
      navigate('/login', { state: { from: '/checkout' } });
    } else {
      navigate('/checkout');
    }
  };

  return (
    <main className={`page ${isMobile ? 'event-detail-page-mobile' : ''}`}>
      <div className="container">
        <div className="breadcrumb">
          <Link to="/browse">Events</Link> / {event.title}
        </div>

        <div className="detail-grid">
          <div className="detail-head-area">
            {/* Head */}
            <div className="detail-head">
              <Poster hue={event.posterHue} emoji={categoryEmoji(event.category)} label="portrait banner 3:4" imageUrl={event.posterUrl} />
              <div className="detail-title">
                <h1>{event.title}</h1>
                <div className="detail-meta">
                  <span>📅 {fmtDate(event.date)}, {fmtTime(event.date)}</span>
                  <span>📍 <Link to={`/venues/${venue.id}`} className="link">{venue.name}</Link>, {venue.city}</span>
                  <span>⏱ {event.durationHrs} hrs</span>
                </div>
                <div className="chip-row" style={{ alignItems: 'center' }}>
                  {event.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                  <ShareButton path={`/events/${event.slug}`} text={`${event.title} 🎟️ — book on Prebooze:`} />
                  {(event.socialBanners?.postUrl || event.socialBanners?.storyUrl) && (
                    <>
                      {event.socialBanners.postUrl && (
                        <a href={event.socialBanners.postUrl} download className="chip small" style={{ textDecoration: 'none' }}>
                          ⬇ Post image
                        </a>
                      )}
                      {event.socialBanners.storyUrl && (
                        <a href={event.socialBanners.storyUrl} download className="chip small" style={{ textDecoration: 'none' }}>
                          ⬇ Story image
                        </a>
                      )}
                    </>
                  )}
                </div>

                {/* Hosted by + who's going — fills the space under the title */}
                <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                  <Link
                    to={`/organizers/${organizer.id}`}
                    className="evrow"
                    style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}
                  >
                    {organizer.logoUrl ? (
                      <img src={organizer.logoUrl} alt="" style={{ width: 34, height: 34, borderRadius: '50%', objectFit: 'cover', flexShrink: 0 }} />
                    ) : (
                      <span style={{ width: 34, height: 34, borderRadius: '50%', background: `hsl(${organizer.logoHue} 55% 45%)`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>🎧</span>
                    )}
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
          </div>

          <div className="detail-about">
            {/* About */}
            <section className="section" style={{ marginTop: 0 }}>
              <div className="section-hd">
                <h2>About this event</h2>
              </div>
              <div
                className="muted rich-text"
                style={{ fontSize: 14, maxHeight: expanded ? 'none' : 90, overflow: 'hidden' }}
                dangerouslySetInnerHTML={{ __html: event.description }}
              />
              {stripHtml(event.description).length > 220 && (
                <button className="btn btn-ghost btn-sm" style={{ marginTop: 10 }} onClick={() => setExpanded((e) => !e)}>
                  {expanded ? 'Show less ▴' : 'Read more ▾'}
                </button>
              )}
            </section>
          </div>

          <div className="detail-rest">
            {/* Teaser reel */}
            {event.teaserVideoUrl && (
              <section className="section">
                <div className="section-hd">
                  <h2>Teaser</h2>
                </div>
                <video
                  src={event.teaserVideoUrl}
                  controls
                  muted
                  playsInline
                  style={{ width: '100%', maxWidth: 260, aspectRatio: '9 / 16', borderRadius: 12, background: 'var(--surface-2)', display: 'block' }}
                />
              </section>
            )}

            {/* Gallery */}
            {!!event.galleryUrls?.length && (
              <section className="section">
                <div className="section-hd">
                  <h2>Gallery</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 8 }}>
                  {event.galleryUrls.map((url, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                      <img
                        src={url}
                        alt={`${event.title} photo ${i + 1}`}
                        loading="lazy"
                        style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)' }}
                      />
                    </a>
                  ))}
                </div>
              </section>
            )}

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

            {/* Event rules */}
            {event.rules.length > 0 && (
              <section className="section">
                <div className="section-hd">
                  <h2>Event rules</h2>
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
                {reviews.slice(0, 2).map((r) => (
                  <div key={r.id} className="review">
                    <span className="bold">{r.author}</span> · <Stars rating={r.rating} />
                    {r.eventTitle && <> · <span className="muted-2">{r.eventTitle}</span></>}
                    <div className="muted">“{r.text}”</div>
                  </div>
                ))}
                {liveEvent && reviews.length === 0 && <div className="tiny muted">No reviews yet.</div>}
                <Link to={`/organizers/${organizer.id}`} className="link small bold">
                  Read all reviews →
                </Link>
              </div>
            </section>
          </div>

          {/* Mobile only: the "single Book ticket button" pattern, fixed to
              the bottom of the screen (not sticky-top) — tapping it opens
              the full tier list as a bottom sheet with a backdrop. Desktop
              never collapses at all; it's the same sticky sidebar it always
              was. */}
          {isMobile && ticketBoxOpen && (
            <div className="ticket-sheet-backdrop" onClick={() => setTicketBoxOpen(false)} />
          )}
          <aside className={`ticket-box card card-shadow ${isMobile ? (ticketBoxOpen ? 'ticket-box-sheet' : 'ticket-box-bar') : ''}`}>
            {refPromoter && showFullTicketBox && (
              <div className="dashed-box" style={{ border: '1.5px dashed var(--accent)', borderRadius: 10, padding: '8px 10px', fontSize: 12, marginBottom: 12 }}>
                📣 Referred by <b>{refPromoter.name}</b> — they’ll be credited for your booking.
              </div>
            )}
            {!showFullTicketBox ? (
              <button className="btn btn-pri btn-block btn-lg" onClick={() => setTicketBoxOpen(true)}>
                {allSoldOut ? '😔 Sold out — join the waitlist' : `🎟 Book ticket — from ₹${minPrice} →`}
              </button>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                  <h3>Select tickets</h3>
                  {isMobile && (
                    <button className="btn btn-ghost btn-sm" aria-label="Collapse" onClick={() => setTicketBoxOpen(false)}>✕</button>
                  )}
                </div>
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
            {allSoldOut ? (
              <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                <div className="bold" style={{ marginBottom: 4 }}>Sold out 😔</div>
                {myEntry?.status === 'offered' ? (
                  <>
                    <div className="accent bold small" style={{ marginBottom: 8 }}>🎉 A spot just opened up for you!</div>
                    <div className="tiny muted-2">First come, first served — complete your booking before it's re-offered.</div>
                  </>
                ) : myEntry ? (
                  <>
                    <div className="accent bold small" style={{ marginBottom: 4 }}>You're #{myPosition} in the waitlist</div>
                    <div className="tiny muted-2">If someone cancels, spots are offered first-come first-served. We'll ping your WhatsApp.</div>
                  </>
                ) : user ? (
                  <>
                    <p className="tiny muted" style={{ marginBottom: 10 }}>
                      Join the waitlist — if a ticket frees up (cancellation), it's offered in queue order.
                    </p>
                    <button
                      className="btn btn-pri btn-block"
                      onClick={() => {
                        joinWaitlist(event.id);
                        setTimeout(refetchWaitlist, 600); // let the real POST land, then pull the authoritative queue
                      }}
                    >
                      🎗 Join the waitlist ({queue.filter((w) => w.status === 'waiting').length} waiting)
                    </button>
                  </>
                ) : (
                  <Link to="/login" className="btn btn-pri btn-block">Log in to join the waitlist</Link>
                )}
              </div>
            ) : existingRole(user) ? (
              <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5 }} >
                🔒 {roleLabel(existingRole(user)!)[0].toUpperCase() + roleLabel(existingRole(user)!).slice(1)} accounts can't book tickets — use a personal number to attend as a guest.
              </div>
            ) : salesPaused ? (
              <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: '10px 12px', fontSize: 12.5 }}>
                🎫 Ticket sales are temporarily paused platform-wide — check back shortly.
              </div>
            ) : (
              <button className="btn btn-pri btn-block btn-lg" disabled={ticketCount === 0} onClick={book}>
                {ticketCount === 0
                  ? 'Select tickets'
                  : `Book ${ticketCount} ticket${ticketCount > 1 ? 's' : ''} →`}
              </button>
            )}
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
              </>
            )}
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
