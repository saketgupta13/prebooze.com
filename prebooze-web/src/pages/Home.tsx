import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import {
  CATEGORIES, CATEGORY_TREE, EVENTS, FAQS, LINEUPS, ORGANIZERS, PEOPLE, PROMOTERS, TESTIMONIALS, VENUES,
  venueById,
} from '../data/mock';
import { catalog, content } from '../api';
import { isBackendEnabled } from '../api/client';
import type { CmsTestimonial, CmsBlogSummary, Event, Organizer, PromoterProfile, LineupProfile, Person, Venue } from '../types';
import { personFollowKey } from '../lib/social';
import { featuredRefs, featuredFirst } from '../lib/featured';
import { organizerPath, promoterPath, lineupPath, venuePath, cityBrowse, cityOrganizers, cityPromoters, cityLineups, cityVenues, cityPeople as cityPeoplePath } from '../lib/urls';
import EventCard from '../components/EventCard';
import DirectoryCard from '../components/DirectoryCard';
import DirectoryCardSkeleton from '../components/DirectoryCardSkeleton';
import Slider from '../components/Slider';
import Poster from '../components/Poster';
import CategoryIcon from '../components/CategoryIcon';
import { ShoppingCart, X } from 'lucide-react';
import ReelCard from '../components/ReelCard';
import Accordion from '../components/Accordion';
import Stars from '../components/Stars';
import { useSeo } from '../lib/useSeo';

// Same hue-from-id + date format as pages/static/Blog.tsx — kept local
// rather than shared since it's a two-line pure function, not worth a
// lib file for.
const blogHueFromId = (id: string) => {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) % 360;
  return h;
};
const fmtBlogDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

const HERO = [
  { hue: 95, emoji: '🎉', badge: 'Featured', title: "Your city's events, one tap away", text: 'Concerts, comedy, festivals and warehouse parties — instant WhatsApp tickets, QR entry, zero fakes.', cta: 'Explore events →', to: '/browse' },
  { hue: 285, emoji: '📣', badge: 'Guest lists', title: 'Free entry before the cutoff', text: 'Join a promoter’s guest list and walk in free — no ticket needed if you’re early.', cta: 'Find promoters →', to: '/promoters' },
  { hue: 200, emoji: '👀', badge: 'Who’s going', title: 'See who’s going before you book', text: 'Follow your friends and spot the crowd on every event in your city.', cta: 'Find your people →', to: '/people' },
  { hue: 30, emoji: '🎤', badge: 'For hosts', title: 'Host an event, get paid weekly', text: 'List in minutes, sell tickets, scan QR at the gate — payouts every week.', cta: 'Host with us →', to: '/host' },
  { hue: 330, emoji: '🎧', badge: 'Line-ups', title: 'Catch your favourite acts live', text: 'Follow DJs, bands and comedians — never miss their next set.', cta: 'Browse line-ups →', to: '/lineups' },
];

// Offline/dev-mode fallback only, when there's no real Reel data to fetch —
// same "mock is never a loading placeholder in production" rule as every
// other real-data section on this page.
const REEL_HUES = [20, 150, 260, 330, 45, 95, 200, 285, 12, 340, 170, 60];

const TRUST = [
  { icon: '✅', title: 'Verified organizers only', desc: 'Every host is KYC-checked. No fake listings, ever.' },
  { icon: '💬', title: 'WhatsApp OTP login', desc: 'No passwords. Your tickets land straight in your chats.' },
  { icon: '🔒', title: 'Secure QR entry', desc: 'Screenshot-proof, time-rotating codes — impossible to fake.' },
  { icon: '↩️', title: 'Easy cancellations', desc: 'Plans change? Cancel any time before the event. Instant wallet credit, or back to your card/UPI in a few days.' },
  { icon: '👀', title: 'See who’s going', desc: 'Follow friends and spot the crowd before you book.' },
  { icon: '⚡', title: 'Book in 20 seconds', desc: 'Pick, pay with UPI, walk in. That’s the whole flow.' },
  { icon: '🎟️', title: 'Fair, transparent fees', desc: 'What you see is what you pay — no surprise charges at checkout.' },
  { icon: '📍', title: 'Local to your city', desc: 'Every listing is filtered to your city — only what you can actually attend.' },
];

const HOW: Record<'guests' | 'organizers' | 'promoters' | 'lineups' | 'venues', { label: string; steps: { icon: string; t: string; d: string }[] }> = {
  guests: {
    label: 'For guests',
    steps: [
      { icon: '🔎', t: 'Find an event', d: 'Browse concerts, comedy and parties in your city.' },
      { icon: '💬', t: 'Login with WhatsApp', d: 'One OTP, no password. 20 seconds flat.' },
      { icon: '💳', t: 'Pay & get your QR', d: 'UPI or card — ticket lands in WhatsApp instantly.' },
      { icon: '🎉', t: 'Scan at entry', d: 'Show your QR, walk in, enjoy the night.' },
    ],
  },
  organizers: {
    label: 'For organizers',
    steps: [
      { icon: '📝', t: 'Create your event', d: 'Set tickets, tiers and guest-list rules in minutes.' },
      { icon: '✅', t: 'Get verified & go live', d: 'Quick KYC, then publish to the whole city.' },
      { icon: '📈', t: 'Guests book instantly', d: 'Discovery, social proof and coupons do the selling.' },
      { icon: '💰', t: 'Scan & get paid', d: 'Check in at the gate, payouts land weekly.' },
    ],
  },
  promoters: {
    label: 'For promoters',
    steps: [
      { icon: '🤝', t: 'Get approved', d: 'Sign up, pass KYC, get added to an event’s allow-list.' },
      { icon: '🔗', t: 'Share your link', d: 'Every event gives you a personal affiliate guest-list link.' },
      { icon: '📋', t: 'Fill the list', d: 'Guests join free before the cutoff; watch arrivals live.' },
      { icon: '💸', t: 'Earn per head', d: 'The organizer pays you for every guest who shows up.' },
    ],
  },
  lineups: {
    label: 'For line-ups',
    steps: [
      { icon: '🎧', t: 'Create your profile', d: 'DJ, band or comedian — set your genre, city and links.' },
      { icon: '⭐', t: 'Grow your following', d: 'Fans follow you and get pinged on your next set.' },
      { icon: '📅', t: 'Get booked', d: 'Organizers add you to their line-ups and events.' },
      { icon: '🔥', t: 'Sell out shows', d: 'Your name on the poster pulls your crowd in.' },
    ],
  },
  venues: {
    label: 'For venues',
    steps: [
      { icon: '🏛', t: 'List your venue', d: 'Photos, capacity, amenities and license — one quick form.' },
      { icon: '✅', t: 'Get verified', d: 'Admin reviews your documents; the badge builds trust.' },
      { icon: '📅', t: 'Host events', d: 'Organizers pick your venue while creating their events.' },
      { icon: '📈', t: 'Fill your nights', d: 'Every event page, ticket and search points guests to you.' },
    ],
  },
};

function EventCardSkeleton() {
  return (
    <div className="skel-pulse" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="skel-bar poster" style={{ aspectRatio: '3 / 4', background: 'var(--surface-2)' }} />
      <div className="skel-bar" style={{ width: '80%', height: 15 }} />
      <div className="skel-bar" style={{ width: '55%', height: 11 }} />
      <div className="skel-bar" style={{ width: '40%', height: 22, marginTop: 4 }} />
    </div>
  );
}

function ReelSkeleton() {
  return <div className="skel-bar poster reel skel-pulse" style={{ background: 'var(--surface-2)' }} />;
}

function VenueCardSkeleton() {
  return (
    <div className="skel-pulse" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div className="skel-bar poster landscape" style={{ background: 'var(--surface-2)' }} />
      <div className="skel-bar" style={{ width: '65%', height: 15 }} />
      <div className="skel-bar" style={{ width: '45%', height: 11 }} />
    </div>
  );
}

function TestimonialSkeleton() {
  return (
    <div className="card skel-pulse" style={{ display: 'flex', flexDirection: 'column' }}>
      <div className="skel-bar" style={{ width: 88, height: 14 }} />
      <div className="skel-bar" style={{ width: '100%', height: 12, marginTop: 12 }} />
      <div className="skel-bar" style={{ width: '90%', height: 12, marginTop: 6 }} />
      <div className="skel-bar" style={{ width: '65%', height: 12, marginTop: 6 }} />
      <div className="skel-bar" style={{ width: '40%', height: 13, marginTop: 14 }} />
    </div>
  );
}

const HOME_EVENT_LIMIT = 8;

const JOIN = [
  { icon: '🎤', title: 'Host events', desc: 'List your event, sell tickets, scan QR at the gate — payouts weekly.', cta: 'Host with us →', to: '/host' },
  { icon: '📣', title: 'Become a promoter', desc: 'Run guest lists with your own affiliate links and earn per head.', cta: 'Start promoting →', to: '/promoter/onboarding' },
  { icon: '🎧', title: 'Join as line-up', desc: 'DJs, bands and comedians — get a profile and get booked.', cta: 'Create artist profile →', to: '/lineup/onboarding' },
  { icon: '🏛', title: 'List your venue', desc: 'Clubs, rooftops and warehouses — get verified and host events.', cta: 'List my venue →', to: '/venue/onboarding' },
];

export default function Home() {
  useSeo();
  const { city, user, carts, setSelection, following, toggleFollow, featured, netFollowers } = useApp();
  const orgFeat = featuredRefs(featured, 'organizer', city);
  const promoFeat = featuredRefs(featured, 'promoter', city);
  const lineFeat = featuredRefs(featured, 'lineup', city);
  const venueFeat = featuredRefs(featured, 'venue', city);
  const eventFeat = featuredRefs(featured, 'event', city);
  const navigate = useNavigate();
  const [cat, setCat] = useState('All');
  const [howTab, setHowTab] = useState<'guests' | 'organizers' | 'promoters' | 'lineups' | 'venues'>('guests');
  const [dismissed, setDismissed] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);

  // auto-advance the hero every 5s
  useEffect(() => {
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % HERO.length), 5000);
    return () => clearInterval(t);
  }, []);

  // Real catalog events (all cities — city filtering happens below, same as
  // the mock path) with a mock fallback when the backend is unreachable.
  const [liveEvents, setLiveEvents] = useState<Event[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.events({}).then(setLiveEvents).catch(() => setLiveEvents([]));
  }, []);

  // Real category list (EventCategory) — CATEGORY_TREE/CATEGORIES stay only
  // as the offline/dev-mode fallback.
  const [liveCategories, setLiveCategories] = useState<{ name: string; icon: string; subs: string[] }[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.categories().then(setLiveCategories).catch(() => setLiveCategories([]));
  }, []);

  // Real, admin-managed reels (Content > Reels) — the "Things happening at
  // events" strip used to be 12 hardcoded hue placeholders with no data
  // behind them at all, even though a real Reel model + admin CRUD + public
  // GET /reels already existed and just had no frontend consumer.
  const [liveReels, setLiveReels] = useState<{ id: string; title: string; hue: number; videoUrl: string | null; posterUrl: string | null }[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.reels().then(setLiveReels).catch(() => setLiveReels([]));
  }, []);
  // REEL_HUES was reused as the live loading placeholder too (see the old
  // comment this replaced), reasoned to be fine since the color blocks
  // aren't "fabricated claims" — but it's a fixed 12 items swapping for
  // however many real reels actually exist (4 in production today), so the
  // slider visibly changes width/content the instant the real fetch
  // resolves. A real flicker, just not a fake-data one. Same
  // isBackendEnabled() guard as every other section now — REEL_HUES stays
  // only for the offline/dev-mode fallback.
  const reelsLoading = isBackendEnabled() && liveReels === null;
  const [liveTestimonials, setLiveTestimonials] = useState<CmsTestimonial[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    content.testimonials().then(setLiveTestimonials).catch(() => setLiveTestimonials([]));
  }, []);
  const testimonials = liveTestimonials ?? (isBackendEnabled() ? [] : TESTIMONIALS);
  // Real quotes only — unlike Reels' abstract hue placeholders, showing
  // TESTIMONIALS' fabricated names/quotes during the loading window would
  // be presenting fake reviews as real ones, so this gets a genuine
  // skeleton (below) instead of a mock-data fallback.
  const testimonialsLoading = isBackendEnabled() && liveTestimonials === null;
  const [liveBlogPosts, setLiveBlogPosts] = useState<CmsBlogSummary[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    content.blogs().then(setLiveBlogPosts).catch(() => setLiveBlogPosts([]));
  }, []);
  // Same "real content only, no fake fallback" rule pages/static/Blog.tsx
  // already applies — while loading (or if nothing's published yet) the
  // section just doesn't render, no skeleton/fabricated post needed for
  // what's a supplementary homepage section, not a core one.
  const blogPosts = (liveBlogPosts ?? []).slice(0, 6);
  const categoriesLoading = isBackendEnabled() && liveCategories === null;
  const categoryTree = liveCategories ?? (isBackendEnabled() ? [] : CATEGORY_TREE);
  // This unconditionally fell through to the mock CATEGORIES chip set
  // during the loading window in production too (missing the same
  // isBackendEnabled() guard categoryTree just above already has) — every
  // load briefly showed the wrong chip labels/count before swapping to the
  // real ones, a real flicker confirmed via a throttled-network replay.
  // 'All' alone during loading avoids showing anything wrong at all.
  const categoryChips = liveCategories ? ['All', ...liveCategories.map((c) => c.name)] : (isBackendEnabled() ? ['All'] : CATEGORIES);

  // Real, city-scoped "top X" directories — mock ORGANIZERS/PROMOTERS/
  // LINEUPS/VENUES stay only as the offline/dev-mode fallback. Each section
  // below hides itself when the live list is empty (e.g. lineups/promoters
  // have no real signups yet) instead of always showing 10 fabricated
  // cards — "show what's available, hide what's not" per city.
  const [liveOrganizers, setLiveOrganizers] = useState<Organizer[] | null>(null);
  const [livePromoters, setLivePromoters] = useState<PromoterProfile[] | null>(null);
  const [liveLineups, setLiveLineups] = useState<LineupProfile[] | null>(null);
  const [liveVenues, setLiveVenues] = useState<Venue[] | null>(null);
  // Real, opt-in "People" directory (User.discoverable) — PEOPLE stays only
  // as the offline/dev-mode fallback, same reasoning as the pools above.
  const [livePeople, setLivePeople] = useState<Person[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    catalog.organizers(city).then(setLiveOrganizers).catch(() => setLiveOrganizers([]));
    catalog.promoters(city).then(setLivePromoters).catch(() => setLivePromoters([]));
    catalog.lineups(city).then(setLiveLineups).catch(() => setLiveLineups([]));
    catalog.venues(city).then(setLiveVenues).catch(() => setLiveVenues([]));
    catalog.people(city).then(setLivePeople).catch(() => setLivePeople([]));
  }, [city]);
  // Each fetch above resolves at a different time — without tracking these,
  // every section below hid itself (rendered nothing) until its own call
  // finished, then popped into existence and shoved everything after it
  // down the page. That's the dominant source of the measured layout
  // shift: up to 4 independent pop-ins on every single homepage load.
  const orgLoading = isBackendEnabled() && liveOrganizers === null;
  const promoLoading = isBackendEnabled() && livePromoters === null;
  const lineupLoading = isBackendEnabled() && liveLineups === null;
  const venueLoading = isBackendEnabled() && liveVenues === null;
  // This one was missing entirely (unlike the four above) — "Top selling
  // events" is the most prominent section on the page (right under the
  // hero) and had zero loading guard, so on every load it genuinely showed
  // "No events in {city} yet." for the ~200-300ms the real fetch was in
  // flight, then swapped to the real grid the instant it resolved. That's
  // the dominant visible flicker, worse than any of the skeleton sections.
  const eventsLoading = isBackendEnabled() && liveEvents === null;

  // Same isBackendEnabled() guard as everywhere else on this page — without
  // it, the brief liveEvents===null window on first load fell through to
  // mock EVENTS in production too, flashing wrong events before the real
  // GET /events response replaced them a moment later.
  const published = liveEvents ?? (isBackendEnabled() ? [] : EVENTS.filter((e) => e.status === 'approved'));
  const cityOf = (e: Event) => e.venue?.city ?? e.privateCity ?? (e.venueId ? venueById(e.venueId)?.city : undefined);
  const soldOf = (e: Event) => e.tiers.reduce((a, t) => a + t.sold, 0);
  const events = useMemo(
    () =>
      featuredFirst(
        (cat === 'All' ? published : published.filter((e) => e.category === cat))
          .filter((e) => cityOf(e) === city)
          .sort((a, b) => soldOf(b) - soldOf(a)),
        (e) => e.id,
        eventFeat
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [published, cat, city, eventFeat]
  );

  // Strictly city-scoped top lists — empty sections are hidden. The
  // organizer/promoter/lineup/venue lists are real (server already
  // city-filters them); mock fallback only applies offline.
  const byCity = <T extends { city: string }>(arr: T[]) => arr.filter((x) => x.city === city);
  const orgPool = liveOrganizers ?? (isBackendEnabled() ? [] : byCity(ORGANIZERS));
  const promoterPool = livePromoters ?? (isBackendEnabled() ? [] : byCity(PROMOTERS));
  const lineupPool = liveLineups ?? (isBackendEnabled() ? [] : byCity(LINEUPS));
  const venuePool = liveVenues ?? (isBackendEnabled() ? [] : byCity(VENUES));
  const topOrganizers = featuredFirst([...orgPool].sort((a, b) => b.eventsHosted - a.eventsHosted), (o) => o.id, orgFeat).slice(0, 10);
  const topPromoters = featuredFirst([...promoterPool].sort((a, b) => b.showRate - a.showRate), (p) => p.slug, promoFeat).slice(0, 10);
  const topLineups = featuredFirst([...lineupPool].sort((a, b) => b.followers - a.followers), (l) => l.slug, lineFeat).slice(0, 10);
  const topVenues = featuredFirst([...venuePool].sort((a, b) => b.rating - a.rating), (v) => v.id, venueFeat).slice(0, 10);
  const peoplePool = livePeople ?? (isBackendEnabled() ? [] : byCity(PEOPLE));
  const cityPeople = [...peoplePool].sort((a, b) => b.followers - a.followers).slice(0, 10);

  const resumeCart = user
    ? [...carts].filter((c) => c.userPhone === user.phone && c.status !== 'completed').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    : undefined;
  const resume = () => {
    if (!resumeCart) return;
    setSelection({ eventId: resumeCart.eventId, qty: resumeCart.qtyMap });
    navigate('/checkout');
  };

  // isOwn hides the button entirely rather than disabling it — same
  // treatment OrganizerProfile.tsx/VenueDetail.tsx/LineupProfile.tsx already
  // give their own "isOwnProfile" case; this just closes the gap where the
  // same organizer/promoter/line-up could still follow (and inflate) their
  // own follower count from the home page slider cards.
  const followBtn = (key: string, isOwn = false) =>
    isOwn ? null : (
      <button className={`btn btn-sm btn-block ${following.includes(key) ? 'btn-ghost' : 'btn-pri'}`} onClick={() => toggleFollow(key)}>
        {following.includes(key) ? 'Following ✓' : '+ Follow'}
      </button>
    );

  return (
    <main className="page">
      <div className="container">
        {resumeCart && !dismissed && (
          <div className="card resume-cart-card" style={{ marginBottom: 16, padding: '16px 18px', borderColor: 'var(--accent)', background: 'rgba(155,225,61,.06)', position: 'relative' }}>
            <button className="resume-cart-dismiss" onClick={() => setDismissed(true)} aria-label="dismiss"><X size={15} /></button>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <span className="resume-cart-icon"><ShoppingCart size={20} /></span>
              <div style={{ flex: 1, minWidth: 0, paddingRight: 22 }}>
                <div className="small bold">You left {resumeCart.qty} ticket{resumeCart.qty > 1 ? 's' : ''} for {resumeCart.eventTitle}</div>
                <div className="tiny muted-2">Finish before they sell out · {resumeCart.tierSummary} · ₹{resumeCart.total}</div>
              </div>
            </div>
            <button className="btn btn-pri btn-block" style={{ marginTop: 14 }} onClick={resume}>Resume checkout →</button>
          </div>
        )}

        {/* Hero slider */}
        <div className="hero-slider">
          {(() => {
            const h = HERO[heroIdx];
            return (
              <div className="hero-slide">
                <div className="hero-bg" style={{ background: `radial-gradient(ellipse at 28% 24%, hsla(${h.hue},70%,52%,.42), transparent 60%), radial-gradient(ellipse at 78% 82%, hsla(${(h.hue + 60) % 360},65%,45%,.30), transparent 55%), var(--surface-2)` }} />
                <div className="hero-ov" />
                <div className="hero-inner">
                  <span className="badge badge-accent">{h.emoji} {h.badge} · {city}</span>
                  <h1>{h.title}</h1>
                  <p>{h.text}</p>
                  <Link to={h.to} className="btn btn-pri btn-lg hero-cta">{h.cta}</Link>
                </div>
              </div>
            );
          })()}
          <button className="hero-arrow left" onClick={() => setHeroIdx((i) => (i - 1 + HERO.length) % HERO.length)} aria-label="Previous">‹</button>
          <button className="hero-arrow right" onClick={() => setHeroIdx((i) => (i + 1) % HERO.length)} aria-label="Next">›</button>
          <div className="hero-dots">
            {HERO.map((_, i) => (
              <button key={i} className={i === heroIdx ? 'on' : ''} onClick={() => setHeroIdx(i)} aria-label={`Slide ${i + 1}`} />
            ))}
          </div>
        </div>

        {/* Category tiles — only categories with events; slider only when >8.
            Depends on both categories and events, and sits directly above
            "Top selling events" — popping in once both resolve (the old
            behavior) visibly shoved that section (and its new skeleton)
            down a moment after first paint, confirmed via a throttled
            replay. A skeleton reservation here avoids that shift instead of
            just not rendering until ready. */}
        {(categoriesLoading || eventsLoading) ? (
          <div style={{ display: 'flex', gap: 12, marginBottom: 24 }}>
            {Array.from({ length: 4 }, (_, i) => (
              <div key={i} className="skel-bar skel-pulse" style={{ width: 130, height: 74, borderRadius: 12, flexShrink: 0 }} />
            ))}
          </div>
        ) : (() => {
          const tiles = categoryTree.map((c) => ({
            ...c,
            n: published.filter((e) => e.category === c.name && cityOf(e) === city).length,
          })).filter((c) => c.n > 0);
          if (tiles.length === 0) return null;
          const cells = tiles.map((c) => (
            <Link key={c.name} to={`${cityBrowse(city)}?cat=${encodeURIComponent(c.name)}`} className="citypick-cell" style={{ textDecoration: 'none', minWidth: 130 }}>
              <span className="ic"><CategoryIcon name={c.name} size={26} /></span>
              <span className="nm">{c.name}</span>
              <span className="ct">{c.n} event{c.n === 1 ? '' : 's'}</span>
            </Link>
          ));
          return (
            <div style={{ marginBottom: 24 }}>
              {tiles.length > 8 ? (
                <Slider slideWidth={150}>{cells}</Slider>
              ) : (
                <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>{cells}</div>
              )}
            </div>
          );
        })()}

        {/* Top selling events */}
        <div className="section-hd">
          <h2>Top selling events in {city}</h2>
          <Link to={cityBrowse(city)}>See all →</Link>
        </div>
        <div className="chip-row" style={{ marginBottom: 18 }}>
          {categoryChips.map((c) => (
            <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              {c !== 'All' && <CategoryIcon name={c} size={14} />} {c}
            </button>
          ))}
        </div>
        <div className="grid-4">
          {eventsLoading
            ? Array.from({ length: 8 }, (_, i) => <EventCardSkeleton key={i} />)
            : events.slice(0, HOME_EVENT_LIMIT).map((e) => <EventCard key={e.id} event={e} />)}
        </div>
        {!eventsLoading && events.length === 0 && <div className="empty">No events in {city} yet.</div>}
        {events.length > HOME_EVENT_LIMIT && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to={cityBrowse(city)} className="btn btn-ghost">Browse all events →</Link>
          </div>
        )}

        {/* People going out in the city — real, opt-in guests only
            (User.discoverable); PEOPLE mock stays only as the offline
            fallback via peoplePool above.
            No loading skeleton here (unlike organizers/promoters/etc. above)
            — this is a brand-new opt-in feature that will genuinely resolve
            empty for most cities for a while, and a skeleton that then
            collapses to nothing is a worse flicker than just not rendering
            the section until it's known to have real content. */}
        {cityPeople.length > 0 && (
        <section className="section">
          <div className="section-hd">
            <h2>Going out in {city} 🔥</h2>
            <Link to={cityPeoplePath(city)}>See all people →</Link>
          </div>
          <div className="card" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex' }}>
              {cityPeople.slice(0, 6).map((p, i) => (
                <span key={p.id} title={p.name} style={{ width: 34, height: 34, borderRadius: '50%', background: `hsl(${p.avatarHue} 55% 45%)`, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, marginLeft: i ? -10 : 0, border: '2px solid var(--bg)', overflow: 'hidden' }}>
                  {p.avatarUrl ? <img src={p.avatarUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : p.name[0]}
                </span>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="bold">{cityPeople.length}+ people going out in {city}</div>
              <div className="tiny muted-2">Follow them to see which parties they’re hitting — before the tickets go.</div>
            </div>
            <Link to={cityPeoplePath(city)} className="btn btn-pri btn-sm">Find your people →</Link>
          </div>
          <Slider slideWidth={244}>
            {cityPeople.map((p) => (
              <DirectoryCard key={p.id} to={`/u/${p.username}`} hue={p.avatarHue} avatarImage={p.avatarUrl} avatarText={p.name[0]} name={p.name} verified={p.verified} meta={`@${p.username} · ${p.city}`} bio={p.bio}
                stats={<><b>{netFollowers(personFollowKey(p.id), p.followers).toLocaleString('en-IN')}</b> followers · <b>{(p.going ?? []).length}</b> going</>}
                action={followBtn(personFollowKey(p.id))} />
            ))}
          </Slider>
        </section>
        )}

        {/* Reels — REEL_HUES stays only as the offline/dev-mode fallback
            (isBackendEnabled() guard), not a live loading placeholder;
            reelsLoading gets a real skeleton instead, sized to match
            however many reels actually load in rather than a fixed 12. */}
        {(reelsLoading || (liveReels ?? REEL_HUES).length > 0) && (
          <section className="section">
            <div className="section-hd">
              <h2>Things happening at events 🎬</h2>
              <span className="muted-2 small">‹ swipe ›</span>
            </div>
            <Slider slideWidth={150}>
              {reelsLoading
                ? Array.from({ length: 4 }, (_, i) => <ReelSkeleton key={i} />)
                : liveReels
                ? liveReels.map((r) => <ReelCard key={r.id} reel={r} />)
                : REEL_HUES.map((hue, i) => <Poster key={i} hue={hue} emoji="▶" label={`reel ${i + 1}`} variant="reel" />)}
            </Slider>
          </section>
        )}

        {/* Top organizers */}
        {(topOrganizers.length > 0 || orgLoading) && (
        <section className="section">
          <div className="section-hd">
            <h2>Top organizers in {city}</h2>
            <Link to={cityOrganizers(city)}>See all →</Link>
          </div>
          <Slider slideWidth={244}>
            {orgLoading
              ? Array.from({ length: 4 }, (_, i) => <DirectoryCardSkeleton key={i} />)
              : topOrganizers.map((o) => {
                  const live = published.filter((e) => (e.organizer?.id ?? e.organizerId) === o.id).length;
                  return (
                    <DirectoryCard key={o.id} to={organizerPath(o.city, o.id)} hue={o.logoHue} avatarText="🎧" avatarImage={o.logoUrl} name={o.brandName} verified={o.verified} meta={`${o.city} · ★ ${o.rating}`} bio={o.about} featured={orgFeat.has(o.id)}
                      stats={<><b>{o.eventsHosted}</b> events · <b>{live}</b> live · <b>{netFollowers(o.id, o.followers).toLocaleString('en-IN')}</b> followers</>}
                      action={followBtn(o.id, user?.isOrganizer && user.orgUsername?.toLowerCase() === o.username.toLowerCase())} />
                  );
                })}
          </Slider>
        </section>
        )}

        {/* Top promoters */}
        {(topPromoters.length > 0 || promoLoading) && (
        <section className="section">
          <div className="section-hd">
            <h2>Top promoters in {city} 📣</h2>
            <Link to={cityPromoters(city)}>See all →</Link>
          </div>
          <Slider slideWidth={244}>
            {promoLoading
              ? Array.from({ length: 4 }, (_, i) => <DirectoryCardSkeleton key={i} />)
              : topPromoters.map((p) => (
                  <DirectoryCard key={p.slug} to={promoterPath(p.city, p.slug)} hue={p.hue} avatarText="📣" avatarImage={p.logoUrl} name={p.name} verified={p.verified} meta={`${p.city} · ${netFollowers('promoter:' + p.slug, p.followers).toLocaleString('en-IN')} followers`} bio={p.bio} featured={promoFeat.has(p.slug)}
                    stats={<><span className={p.showRate >= 70 ? 'accent bold' : 'bold'}>{p.showRate}%</span> show-rate · <b>{p.guestsBrought.toLocaleString('en-IN')}</b> brought</>}
                    action={followBtn('promoter:' + p.slug, user?.isPromoter && user.promoterUsername?.toLowerCase() === p.slug.toLowerCase())} />
                ))}
          </Slider>
        </section>
        )}

        {/* Top line-ups */}
        {(topLineups.length > 0 || lineupLoading) && (
        <section className="section">
          <div className="section-hd">
            <h2>Top line-ups in {city} 🎤</h2>
            <Link to={cityLineups(city)}>See all →</Link>
          </div>
          <Slider slideWidth={244}>
            {lineupLoading
              ? Array.from({ length: 4 }, (_, i) => <DirectoryCardSkeleton key={i} />)
              : topLineups.map((l) => (
                  <DirectoryCard key={l.slug} to={lineupPath(l.city, l.slug)} hue={l.hue} avatarText={l.emoji} avatarImage={l.logoUrl} name={l.name} verified={l.verified} meta={`${l.category} · ${l.city}`} bio={l.bio} featured={lineFeat.has(l.slug)}
                    stats={<><b>{netFollowers('lineup:' + l.slug, l.followers).toLocaleString('en-IN')}</b> followers · <b>{l.eventsPlayed}</b> shows</>}
                    action={followBtn('lineup:' + l.slug, user?.isLineup && user.lineupUsername?.toLowerCase() === l.slug.toLowerCase())} />
                ))}
          </Slider>
        </section>
        )}

        {/* Trending venues */}
        {(topVenues.length > 0 || venueLoading) && (
        <section className="section">
          <div className="section-hd">
            <h2>Top venues in {city}</h2>
            <Link to={cityVenues(city)}>See all →</Link>
          </div>
          <Slider slideWidth={260}>
            {venueLoading
              ? Array.from({ length: 4 }, (_, i) => <VenueCardSkeleton key={i} />)
              : topVenues.map((v) => {
                  const count = published.filter((e) => (e.venue?.id ?? e.venueId) === v.id).length;
                  return (
                    <Link key={v.id} to={venuePath(v.city, v.id)} className="ecard" style={{ position: 'relative' }}>
                      <Poster hue={v.photoHue} emoji="🏛" label={v.galleryUrls?.[0] ? undefined : 'venue photo'} imageUrl={v.galleryUrls?.[0]} variant="landscape" alt={v.name} />
                      {v.logoUrl && <img src={v.logoUrl} alt="" width={38} height={38} loading="lazy" decoding="async" className="ecard-logo" />}
                      <div>
                        <h3>
                          {v.name} {v.verified && <span className="verified">✓</span>}{' '}
                          {venueFeat.has(v.id) && <span className="badge badge-accent" style={{ fontSize: 10 }}>★ Featured</span>}
                        </h3>
                        <div className="meta">★ {v.rating} · {count} event{count === 1 ? '' : 's'} · {v.type}</div>
                      </div>
                    </Link>
                  );
                })}
          </Slider>
        </section>
        )}

        {/* Why book with us */}
        <section className="section">
          <div className="section-hd"><h2>Why book with us</h2></div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 14 }}>
            {TRUST.map((t) => (
              <div key={t.title} className="card">
                <div style={{ fontSize: 26 }}>{t.icon}</div>
                <h3 style={{ fontSize: 15, marginTop: 8 }}>{t.title}</h3>
                <p className="tiny muted" style={{ marginTop: 4 }}>{t.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="section">
          <div className="section-hd"><h2>How it works</h2></div>
          <div className="chip-row" style={{ marginBottom: 16 }}>
            {(Object.keys(HOW) as (keyof typeof HOW)[]).map((k) => (
              <button key={k} className={`chip ${howTab === k ? 'on' : ''}`} onClick={() => setHowTab(k)}>{HOW[k].label}</button>
            ))}
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 14 }}>
            {HOW[howTab].steps.map((s, i) => (
              <div key={s.t} className="card">
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="num" style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--accent)', color: 'var(--on-accent)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 13 }}>{i + 1}</span>
                  <span style={{ fontSize: 22 }}>{s.icon}</span>
                </div>
                <h3 style={{ fontSize: 15, marginTop: 8 }}>{s.t}</h3>
                <p className="tiny muted" style={{ marginTop: 4 }}>{s.d}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Happy guests */}
        {(testimonials.length > 0 || testimonialsLoading) && (
        <section className="section">
          <div className="section-hd">
            <h2>Happy guests 💚</h2>
            <Link to="/testimonials">Read all reviews →</Link>
          </div>
          <Slider slideWidth={300}>
            {testimonialsLoading
              ? Array.from({ length: 4 }, (_, i) => <TestimonialSkeleton key={i} />)
              : testimonials.map((t) => (
                  <div key={t.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                    <Stars rating={t.rating} />
                    <p style={{ margin: '10px 0 12px', fontSize: 14, flex: 1 }}>"{t.quote}"</p>
                    <div className="small bold">{t.author} <span className="muted-2" style={{ fontWeight: 400 }}>· {t.location}</span></div>
                  </div>
                ))}
          </Slider>
        </section>
        )}

        {/* From the blog */}
        {blogPosts.length > 0 && (
        <section className="section">
          <div className="section-hd">
            <h2>From the blog 📰</h2>
            <Link to="/blog">Read all posts →</Link>
          </div>
          <Slider slideWidth={280}>
            {blogPosts.map((p) => (
              <Link key={p.id} to={`/blog/${p.id}`} className="ecard">
                <Poster hue={blogHueFromId(p.id)} emoji="📰" label="cover 16:9" variant="landscape" imageUrl={p.bannerUrl} alt={p.title} />
                <div>
                  {p.category && <span className="tag" style={{ marginBottom: 6 }}>{p.category}</span>}
                  <h3 style={{ margin: '6px 0 4px' }}>{p.title}</h3>
                  <div className="meta">{p.meta.slice(0, 90)}{p.meta.length > 90 ? '…' : ''}</div>
                  <div className="meta" style={{ marginTop: 6 }}>{fmtBlogDate(p.updatedAt)}</div>
                </div>
              </Link>
            ))}
          </Slider>
        </section>
        )}

        {/* Join us */}
        <section className="section">
          <div className="section-hd"><h2>Join the Prebooze network 🚀</h2></div>
          <p className="muted small" style={{ marginTop: -6, marginBottom: 14 }}>
            Whoever you are in nightlife — there’s a way in.
          </p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 14 }}>
            {JOIN.map((j) => (
              <div key={j.title} className="card" style={{ display: 'flex', flexDirection: 'column', borderColor: 'var(--border)' }}>
                <div style={{ fontSize: 30 }}>{j.icon}</div>
                <h3 style={{ fontSize: 17, marginTop: 8 }}>{j.title}</h3>
                <p className="muted small" style={{ marginTop: 4, flex: 1 }}>{j.desc}</p>
                <Link to={j.to} className="btn btn-pri btn-block btn-sm" style={{ marginTop: 12 }}>{j.cta}</Link>
              </div>
            ))}
          </div>
        </section>

        {/* FAQs */}
        <section className="section" id="faqs">
          <div className="section-hd"><h2>FAQs</h2></div>
          {FAQS.map((f, i) => (
            <Accordion key={f.q} title={f.q} defaultOpen={i === 0}>{f.a}</Accordion>
          ))}
        </section>

      </div>
    </main>
  );
}

