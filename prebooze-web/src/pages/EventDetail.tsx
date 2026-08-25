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
import type { Event, LineupProfile, PromoterProfile, WaitlistEntry } from '../types';
import type { GuestReview } from '../store/AppContext';
import { goingCount, myStatus, showGoing } from '../lib/social';
import { eventLocation } from '../lib/venue';
import { existingRole, roleLabel } from '../lib/roles';
import { stripHtml } from '../lib/richtext';
import { useSeo } from '../lib/useSeo';
import { useJsonLd } from '../lib/useJsonLd';
import { buildEventSchema, buildBreadcrumbSchema } from '../lib/schema';
import { useCityReconcile } from '../lib/useCityReconcile';
import { eventCity, eventPath, cityHome, cityBrowse, organizerPath, venuePath, lineupPath, promoterPath } from '../lib/urls';
import { track } from '../lib/track';
import { trackMeta } from '../lib/meta';
import { usePlatformInfo } from '../lib/usePlatformInfo';
import { formatPrice, formatFromPrice } from '../lib/formatPrice';
import { displayTierPrice, displayMinPrice, hasCurrentlyPaidTier, tierWindowCaption, tierCountdownLabel } from '../lib/ticketTierPricing';
import { useTicker } from '../lib/useTicker';
import { useIsMobile } from '../lib/useIsMobile';
import Poster, { categoryEmoji } from '../components/Poster';
import TeaserReel from '../components/TeaserReel';
import ImageLightbox from '../components/ImageLightbox';
import { PageLoader } from '../components/Loader';
import Accordion from '../components/Accordion';
import Stars from '../components/Stars';
import Stepper from '../components/Stepper';
import EventCard from '../components/EventCard';
import ShareButton from '../components/ShareButton';
import ReviewsSection from '../components/ReviewsSection';

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
  const { user, city, setSelection, myEvents, bookings, interested, toggleInterested, promoterRefByEvent, setPromoterRefForEvent, setPromoterViaForEvent, waitlists, joinWaitlist } = useApp();
  const { salesPaused } = usePlatformInfo();

  const mockEvent = eventBySlug(slug ?? '') ?? myEvents.find((e) => e.slug === slug);
  const [liveEvent, setLiveEvent] = useState<Event | null>(null);
  const [liveReviews, setLiveReviews] = useState<GuestReview[]>([]);
  const [liveRecommended, setLiveRecommended] = useState<Event[]>([]);
  const [loaded, setLoaded] = useState(!isBackendEnabled());
  // The main `loaded` flag flips true as soon as the event itself resolves
  // — it never waited on these two nested, un-awaited fetches, so the page
  // used to flash "No reviews yet." for the ~100ms-1s round trip even for
  // an organizer that has real reviews, before liveReviews caught up.
  const [reviewsLoading, setReviewsLoading] = useState(false);

  const previewToken = params.get('preview') ?? undefined;

  useEffect(() => {
    if (!isBackendEnabled() || !slug) return;
    // Guards against a stale response landing after a newer one (or after
    // unmount) still flipping `loaded`/`liveEvent` — without this, React 18
    // StrictMode's dev-only double-invoke of this effect fired the fetch
    // twice, and the page visibly went loader → content → loader → content
    // on every mount ("loading twice").
    let cancelled = false;
    setLoaded(false);
    catalog
      .event(slug, previewToken)
      .then((e) => {
        if (cancelled) return;
        setLiveEvent(e);
        if (e.organizerId) {
          setReviewsLoading(true);
          social.organizerReviews(e.organizerId).then((r) => { if (!cancelled) setLiveReviews(r); }).catch(() => {}).finally(() => { if (!cancelled) setReviewsLoading(false); });
        }
        catalog.events({ city }).then((all) => { if (!cancelled) setLiveRecommended(all.filter((x) => x.id !== e.id).slice(0, 4)); }).catch(() => {});
      })
      .catch(() => { if (!cancelled) setLiveEvent(null); })
      .finally(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug, previewToken]);

  // Event.lineup is a free-form {name, role}[] JSON blob, not a real
  // relation — lineupByName (the mock lookup below) only ever matched the
  // dummy seed data, so every real event's line-up/partner chips silently
  // never linked anywhere. Fetch the live directory once and match by name.
  const [liveLineups, setLiveLineups] = useState<LineupProfile[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.lineups().then(setLiveLineups).catch(() => setLiveLineups([]));
  }, []);
  const lineups = liveLineups ?? (isBackendEnabled() ? [] : undefined);
  const findLineup = (name: string) =>
    lineups ? lineups.find((l) => l.name.toLowerCase() === name.toLowerCase()) : lineupByName(name);

  // mockEvent is only ever a stand-in for offline dev mode — gating it here
  // (instead of falling through unconditionally) matches every other detail
  // page's convention (OrganizerProfile/PromoterProfile/LineupProfile/
  // VenueDetail all do the same for their own mock fallback).
  const event = liveEvent ?? (isBackendEnabled() ? undefined : mockEvent);
  const eventCityName = event ? eventCity(event) : undefined;
  useCityReconcile(eventCityName, event && eventCityName ? eventPath(eventCityName, event.slug) : undefined);
  useSeo(event?.seo, event?.title, event?.posterUrl);
  useJsonLd(event ? buildEventSchema(event) : null);
  useJsonLd(
    event && eventCityName
      ? buildBreadcrumbSchema([
          { name: 'Home', path: cityHome(eventCityName) },
          { name: 'Events', path: cityBrowse(eventCityName) },
          { name: event.title, path: eventPath(eventCityName, event.slug) },
        ])
      : null,
  );

  // Promoters this event's organizer has allow-listed for free-entry guest
  // lists (Event.promoterConfig.allowedPromoters, a slug array) — matched
  // against the real directory the same way lineup names are, so guests can
  // see (and follow) exactly who's actually running lists for this event.
  const [livePromotersForEvent, setLivePromotersForEvent] = useState<PromoterProfile[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.promoters().then(setLivePromotersForEvent).catch(() => setLivePromotersForEvent([]));
  }, []);
  const promoterPool = livePromotersForEvent ?? (isBackendEnabled() ? [] : PROMOTERS);
  const allowedPromoterSlugs = event?.promoterConfig?.enabled ? (event.promoterConfig.allowedPromoters ?? []) : [];
  const taggedPromoters = promoterPool.filter((p) => allowedPromoterSlugs.includes(p.slug));
  const [qty, setQty] = useState<Record<string, number>>({});
  const [expanded, setExpanded] = useState(false);
  const [galleryIndex, setGalleryIndex] = useState<number | null>(null);
  const [ticketBoxOpen, setTicketBoxOpen] = useState(false);
  useTicker(); // keeps free-entry countdowns below from going stale (5-min tick)
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

  // Credit a promoter for any purchase made through their shared link
  // (?ref=slug) — keyed to this event specifically so it survives a reload
  // and can't be clobbered by a different promoter's link on a different event.
  const ref = params.get('ref');
  const via = params.get('via'); // sub-promoter handle credited within ref's own team
  useEffect(() => {
    if (ref && event?.id) setPromoterRefForEvent(event.id, ref);
  }, [ref, event?.id, setPromoterRefForEvent]);
  useEffect(() => {
    if (ref && via && event?.id) setPromoterViaForEvent(event.id, via);
  }, [ref, via, event?.id, setPromoterViaForEvent]);
  const refSlug = ref ?? (event ? promoterRefByEvent[event.id] : undefined);
  const mockRefPromoter = PROMOTERS.find((p) => p.slug === refSlug);
  // Real lookup — the mock PROMOTERS array never contains a real promoter's
  // slug, so this banner silently never showed for a real ?ref= link even
  // though the actual server-side crediting on checkout already works.
  const [liveRefPromoter, setLiveRefPromoter] = useState<{ name: string } | null>(null);
  useEffect(() => {
    if (!isBackendEnabled() || !refSlug) return;
    catalog.promoter(refSlug).then(setLiveRefPromoter).catch(() => {});
  }, [refSlug]);
  const refPromoter = isBackendEnabled() ? liveRefPromoter : mockRefPromoter;

  useEffect(() => {
    if (event) track('event_viewed', { eventId: event.id, meta: refSlug ? { promoterRef: refSlug, promoterVia: via ?? undefined } : undefined });
    // Client-only — no server-side CAPI mirror (see MetaConversionsService
    // call sites: only Purchase/Lead/CompleteRegistration have a real backend
    // moment to confirm from). Feeds retargeting ("viewed, didn't buy") and
    // gives Meta's optimizer funnel signal above the Purchase event alone.
    if (event) {
      const minPrice = event.tiers.length ? Math.min(...event.tiers.map((t) => t.price)) : undefined;
      trackMeta('ViewContent', {
        content_type: 'product',
        content_ids: [event.id],
        content_name: event.title,
        value: minPrice,
        currency: 'INR',
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [event?.id]);

  const total = useMemo(() => {
    if (!event) return 0;
    return event.tiers.reduce((sum, t) => sum + (qty[t.id] ?? 0) * displayTierPrice(t, event.date), 0);
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
          <Link to={cityBrowse(city)} className="btn btn-pri">
            Browse events
          </Link>
        </div>
      </main>
    );
  }

  const venue = event.venue ?? (event.venueId ? venueById(event.venueId) : undefined);
  const organizer = event.organizer ?? (event.organizerId ? organizerById(event.organizerId) : undefined);
  // A role account showing "Interested" in their own event (as its
  // organizer/venue, or as a line-up tagged on it) isn't a real guest
  // signal — same reasoning as hiding the Follow button on your own
  // profile pages (OrganizerProfile.tsx/VenueDetail.tsx/LineupProfile.tsx).
  const isOwnEvent = Boolean(
    (user?.isOrganizer && user.orgUsername?.toLowerCase() === organizer?.username?.toLowerCase()) ||
    (user?.isVenue && user.venueId === venue?.id) ||
    (user?.isLineup && user.lineupName && event.lineup.some((l) => l.name.toLowerCase() === user.lineupName!.toLowerCase()))
  );
  const ticketCount = Object.values(qty).reduce((a, b) => a + b, 0);
  const minPrice = displayMinPrice(event.tiers, event.date);
  // Gated on isBackendEnabled() (not just liveEvent truthiness) to match
  // every other detail page's mock-fallback convention.
  const recommended = liveEvent ? liveRecommended : (isBackendEnabled() ? [] : EVENTS.filter((e) => e.status === 'approved' && e.id !== event.id).slice(0, 4));
  const reviews = liveEvent ? liveReviews : (isBackendEnabled() ? [] : REVIEWS);

  const going = goingCount(event);
  const allSoldOut = event.tiers.every((t) => t.sold >= t.quantity);
  // Distinct from allSoldOut — this event has already happened, so no
  // cancellation is ever going to free up a spot. The waitlist flow below
  // (allSoldOut branch) only makes sense for a still-upcoming event.
  const eventOver = new Date(event.date).getTime() < Date.now();
  const queue = liveWaitlist ?? waitlists[event.id] ?? [];
  const myEntry = user ? queue.find((w) => w.phone === user.phone) : undefined;
  const myPosition = myEntry ? queue.filter((w) => w.status === 'waiting').findIndex((w) => w.phone === user?.phone) + 1 : 0;
  const status = myStatus(event.id, bookings, interested);

  const book = () => {
    if (existingRole(user)) return; // business/elevated-role account — checkout also blocks this
    track('book_clicked', { eventId: event.id, meta: refSlug ? { promoterRef: refSlug, promoterVia: via ?? undefined } : undefined });
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
        {previewToken && event.status !== 'approved' && (
          <div style={{ background: 'var(--accent)', color: '#fff', padding: '10px 16px', borderRadius: 8, marginBottom: 16, fontWeight: 600 }}>
            Preview mode — this event is {event.status} and isn't visible to guests yet.
          </div>
        )}
        <div className="breadcrumb">
          <Link to={cityBrowse(eventCityName ?? city)}>Events</Link> / {event.title}
        </div>

        <div className="detail-grid">
          <div className="detail-head-area">
            {/* Head */}
            <div className="detail-head">
              <Poster hue={event.posterHue} emoji={categoryEmoji(event.category)} label="portrait banner 3:4" imageUrl={event.posterUrl} alt={event.title} eager />
              <div className="detail-title">
                <h1>{event.title}</h1>
                <div className="detail-meta">
                  <span>📅 {fmtDate(event.date)}, {fmtTime(event.date)}</span>
                  <span>
                    📍 {venue ? (
                      <><Link to={venuePath(venue.city, venue.id)} className="link">{venue.name}</Link>, {venue.city}</>
                    ) : (
                      eventLocation(event)
                    )}
                  </span>
                  <span>⏱ {event.durationHrs} hrs</span>
                  {showGoing(event) && (
                    <span style={{ color: 'var(--accent)', fontWeight: 600 }}>
                      🔥 {going.toLocaleString('en-IN')} going
                      {event.recentActivity && ` · ${event.recentActivity.count} booked ${event.recentActivity.window === 'today' ? 'today' : 'this week'}`}
                    </span>
                  )}
                </div>
                <div className="chip-row" style={{ alignItems: 'center' }}>
                  {event.tags.map((t) => (
                    <span key={t} className="tag">
                      {t}
                    </span>
                  ))}
                  <ShareButton path={eventCityName ? eventPath(eventCityName, event.slug) : `/events/${event.slug}`} text={`${event.title} 🎟️ — book on Prebooze:`} />
                  {event.socialBanners?.storyUrl && (
                    <a href={event.socialBanners.storyUrl} download className="chip small" style={{ textDecoration: 'none' }}>
                      ⬇ Story image
                    </a>
                  )}
                </div>

                {/* Hosted by + who's going — fills the space under the title.
                    A solo venue-hosted event (Event.hostedByVenue, no
                    collaborating organizer) has no organizer to show here at
                    all — the "Hosted at" venue card below is the only host
                    line in that case; when a venue *does* pick a
                    collaborating organizer, both cards render exactly like
                    a normal organizer event with a venue tag. */}
                <div style={{ marginTop: 16, display: 'grid', gap: 10 }}>
                  {organizer && (
                    <Link
                      to={organizerPath(organizer.city, organizer.id)}
                      className="evrow"
                      style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}
                    >
                      {organizer.logoUrl ? (
                        <img src={organizer.logoUrl} alt="" className="avatar" style={{ objectFit: 'cover' }} />
                      ) : (
                        <span className="avatar">🎧</span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="tiny muted-2">{event.hostedByVenue ? 'In collaboration with' : 'Hosted by'}</div>
                        <div className="bold small">
                          {organizer.brandName} {organizer.verified && <span className="verified">✓</span>}{' '}
                          <span className="muted" style={{ fontWeight: 400 }}>· ★ {organizer.rating}</span>
                        </div>
                      </div>
                      <span className="link small">View →</span>
                    </Link>
                  )}

                  {venue ? (
                    <Link
                      to={venuePath(venue.city, venue.id)}
                      className="evrow"
                      style={{ textDecoration: 'none', color: 'inherit', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}
                    >
                      {venue.logoUrl ? (
                        <img src={venue.logoUrl} alt="" className="avatar" style={{ objectFit: 'cover' }} />
                      ) : (
                        <span className="avatar">🏛</span>
                      )}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="tiny muted-2">{event.hostedByVenue ? 'Hosted by' : 'Hosted at'}</div>
                        <div className="bold small">
                          {venue.name} {venue.verified && <span className="verified">✓</span>}
                        </div>
                      </div>
                      <span className="link small">View →</span>
                    </Link>
                  ) : (
                    <div className="evrow" style={{ border: '1px solid var(--border)', borderRadius: 10, padding: '8px 12px' }}>
                      <span className="avatar">📍</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="tiny muted-2">Location</div>
                        <div className="bold small">{eventLocation(event)}</div>
                      </div>
                      <span className="tiny muted-2">Exact address shared by the organizer</span>
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 12px' }}>
                    <div style={{ minWidth: 0 }}>
                      <div className="bold small">
                        {showGoing(event) ? `${going.toLocaleString('en-IN')} going` : going === 0 ? 'Be the first to go 👀' : 'Guests are already going 👀'}
                      </div>
                    </div>
                    <div style={{ flex: 1 }} />
                    {status === 'going' ? (
                      <span className="badge badge-accent">You're going ✓</span>
                    ) : !isOwnEvent ? (
                      <button className={`btn btn-sm ${status === 'interested' ? 'btn-pri' : 'btn-ghost'}`} onClick={() => toggleInterested(event.id)}>
                        {status === 'interested' ? '★ Interested' : '☆ Interested'}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="detail-about">
            {/* About — see .detail-about/.detail-rest rules in index.css for
                why the gap to whatever comes next needed real CSS changes,
                not just this inline marginTop reset. */}
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

            {/* Conditions */}
            {event.conditions.length > 0 && (
              <section className="section">
                <div className="section-hd">
                  <h2>Know before you go</h2>
                </div>
                <ul style={{ paddingLeft: 20, color: 'var(--muted)', fontSize: 14, display: 'grid', gap: 6 }}>
                  {event.conditions.map((c) => (
                    <li key={c}>{c}</li>
                  ))}
                </ul>
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
                    const profile = findLineup(l.name);
                    const inner = (
                      <>
                        {profile?.logoUrl ? (
                          <img src={profile.logoUrl} alt="" className="avatar" style={{ objectFit: 'cover' }} />
                        ) : (
                          <span className="avatar">{profile?.emoji ?? (l.role.includes('DJ') || l.role.includes('artist') ? '🎤' : '🏷')}</span>
                        )}
                        <span className="who">
                          <span className="n" style={{ display: 'block' }}>
                            {l.name} {profile?.verified && <span className="verified">✓</span>}
                          </span>
                          <span className="r">{l.role}{profile ? ' · view profile →' : ''}</span>
                        </span>
                      </>
                    );
                    return profile ? (
                      <Link key={l.name} to={lineupPath(profile.city, profile.slug)} className="lineup-item" style={{ borderColor: 'var(--border-3)' }}>
                        {inner}
                      </Link>
                    ) : (
                      <div key={l.name} className="lineup-item">{inner}</div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* Teaser reel — same poster-first tap-to-play card as the
                homepage's "Live reels" strip, so a guest sees one
                consistent reel UX site-wide. */}
            {event.teaserVideoUrl && (
              <section className="section">
                <div className="section-hd">
                  <h2>Teaser</h2>
                </div>
                <TeaserReel url={event.teaserVideoUrl} title={event.title} hue={event.posterHue} />
              </section>
            )}

            {/* Gallery — auto-fit (not auto-fill) so a handful of photos
                stretch to fill this wide column's full width instead of
                staying pinned to their minmax floor with a row of empty
                reserved-but-unused grid tracks beside them. */}
            {!!event.galleryUrls?.length && (
              <section className="section">
                <div className="section-hd">
                  <h2>Gallery</h2>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8 }}>
                  {event.galleryUrls.map((url, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setGalleryIndex(i)}
                      style={{ padding: 0, border: 0, background: 'none', cursor: 'pointer', font: 'inherit' }}
                    >
                      <img
                        src={url}
                        alt={`${event.title} photo ${i + 1}`}
                        loading="lazy"
                        style={{ width: '100%', aspectRatio: '1 / 1', objectFit: 'cover', borderRadius: 10, border: '1px solid var(--border)', display: 'block' }}
                      />
                    </button>
                  ))}
                </div>
                {galleryIndex !== null && (
                  <ImageLightbox
                    images={event.galleryUrls}
                    index={galleryIndex}
                    onClose={() => setGalleryIndex(null)}
                    onNavigate={setGalleryIndex}
                    alt={(i) => `${event.title} photo ${i + 1}`}
                  />
                )}
              </section>
            )}

            {/* Promoters running guest lists for this event */}
            {taggedPromoters.length > 0 && (
              <section className="section">
                <div className="section-hd">
                  <h2>Promoted by</h2>
                </div>
                <div className="lineup">
                  {taggedPromoters.map((p) => (
                    <Link key={p.slug} to={promoterPath(p.city, p.slug)} className="lineup-item" style={{ borderColor: 'var(--border-3)' }}>
                      <span className="avatar">📣</span>
                      <span className="who">
                        <span className="n" style={{ display: 'block' }}>
                          {p.name} {p.verified && <span className="verified">✓</span>}
                        </span>
                        <span className="r">Free-entry guest list · view profile →</span>
                      </span>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Reviews — a solo venue-hosted event (no organizer at all) has
                nobody to show an "Organizer rating" for; the venue's own
                real review system (ReviewsSection, same component
                VenueDetail.tsx uses) takes over in that one case. */}
            {organizer ? (
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
                  {liveEvent && !reviewsLoading && reviews.length === 0 && <div className="tiny muted">No reviews yet.</div>}
                  <Link to={organizerPath(organizer.city, organizer.id)} className="link small bold">
                    Read all reviews →
                  </Link>
                </div>
              </section>
            ) : venue ? (
              <section className="section">
                <div className="section-hd">
                  <h2>Venue rating & reviews</h2>
                </div>
                <ReviewsSection targetType="venue" targetId={venue.id} prompt="How was this event — sound, entry, staff?" />
              </section>
            ) : null}
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
                {eventOver ? '😔 Sold out' : allSoldOut ? '😔 Sold out — join the waitlist' : `🎟 Book ticket — ${formatFromPrice(minPrice, hasCurrentlyPaidTier(event.tiers, event.date))} →`}
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
              const soldOut = left <= 0 || eventOver;
              return (
                <div key={t.id} className="tier-row">
                  <div className="tier-info">
                    <div className="name">
                      {t.name} — {formatPrice(displayTierPrice(t, event.date))}
                      {!soldOut && left <= 25 && (
                        <span className="danger-text tiny"> · {left} left</span>
                      )}
                    </div>
                    {t.includes.length > 0 && (
                      <div className="includes">✓ {t.includes.join(' · ✓ ')}</div>
                    )}
                    {t.description && <div className="includes" style={{ marginTop: 2 }}>{t.description}</div>}
                    {tierCountdownLabel(t, event.date) && (
                      <div className="tiny accent" style={{ marginTop: 2, fontWeight: 700 }}>
                        ⏳ {tierCountdownLabel(t, event.date)} left at this price
                      </div>
                    )}
                    {tierWindowCaption(t, event.date) && (
                      <div className="tiny muted" style={{ marginTop: 2 }}>{tierWindowCaption(t, event.date)}</div>
                    )}
                    {!!t.coverCharge && (
                      <div className="tiny accent" style={{ marginTop: 2 }}>
                        🍹 Includes ₹{t.coverCharge} redeemable at the venue{t.coverChargeNote ? ` (${t.coverChargeNote})` : ''}
                      </div>
                    )}
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
            {eventOver ? (
              <div className="dashed-box" style={{ border: '1.5px dashed var(--border-dash)', borderRadius: 10, padding: 14, textAlign: 'center' }}>
                <div className="bold" style={{ marginBottom: 4 }}>Sold out 😔</div>
                <div className="tiny muted-2">This event has already happened.</div>
              </div>
            ) : allSoldOut ? (
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
            {status !== 'going' && !isOwnEvent && (
              <button
                className={`btn btn-block btn-sm ${status === 'interested' ? 'btn-pri' : 'btn-ghost'}`}
                style={{ marginTop: 8 }}
                onClick={() => toggleInterested(event.id)}
              >
                {status === 'interested' ? '★ Interested — saved' : '☆ Interested'}
              </button>
            )}
                <div className="tiny muted-2 center" style={{ marginTop: 10 }}>
                  🔒 secure checkout · <Link to="/legal/refund-policy" className="link">cancel any time before the event</Link>
                </div>
              </>
            )}
          </aside>
        </div>

        {/* Recommended */}
        {recommended.length > 0 && (
          <section className="section">
            <div className="section-hd">
              <h2>Recommended events in {city}</h2>
              <Link to={cityBrowse(city)}>See all →</Link>
            </div>
            <div className="grid-4">
              {recommended.map((e) => (
                <EventCard key={e.id} event={e} />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
