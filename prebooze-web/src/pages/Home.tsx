import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import {
  CATEGORIES, EVENTS, FAQS, LINEUPS, ORGANIZERS, PEOPLE, PROMOTERS, TESTIMONIALS, VENUES,
  eventsForPerson, venueById,
} from '../data/mock';
import { friendsGoing, personFollowKey } from '../lib/social';
import EventCard from '../components/EventCard';
import DirectoryCard from '../components/DirectoryCard';
import Slider from '../components/Slider';
import Poster from '../components/Poster';
import Accordion from '../components/Accordion';
import Stars from '../components/Stars';

const HERO = [
  { hue: 95, emoji: '🎉', badge: 'Featured', title: "Your city's events, one tap away", text: 'Concerts, comedy, festivals and warehouse parties — instant WhatsApp tickets, QR entry, zero fakes.', cta: 'Explore events →', to: '/browse' },
  { hue: 285, emoji: '📣', badge: 'Guest lists', title: 'Free entry before the cutoff', text: 'Join a promoter’s guest list and walk in free — no ticket needed if you’re early.', cta: 'Find promoters →', to: '/promoters' },
  { hue: 200, emoji: '👀', badge: 'Who’s going', title: 'See who’s going before you book', text: 'Follow your friends and spot the crowd on every event in your city.', cta: 'Find your people →', to: '/people' },
  { hue: 30, emoji: '🎤', badge: 'For hosts', title: 'Host an event, get paid weekly', text: 'List in minutes, sell tickets, scan QR at the gate — payouts every week.', cta: 'Host with us →', to: '/host' },
  { hue: 330, emoji: '🎧', badge: 'Line-ups', title: 'Catch your favourite acts live', text: 'Follow DJs, bands and comedians — never miss their next set.', cta: 'Browse line-ups →', to: '/lineups' },
];

const TRUST = [
  { icon: '✅', title: 'Verified organizers only', desc: 'Every host is KYC-checked. No fake listings, ever.' },
  { icon: '💬', title: 'WhatsApp OTP login', desc: 'No passwords. Your tickets land straight in your chats.' },
  { icon: '🔒', title: 'Secure QR entry', desc: 'Screenshot-proof, time-rotating codes — impossible to fake.' },
  { icon: '↩️', title: 'Instant refunds', desc: 'Plans change? Money back to source in minutes, up to 48h.' },
  { icon: '👀', title: 'See who’s going', desc: 'Follow friends and spot the crowd before you book.' },
  { icon: '⚡', title: 'Book in 20 seconds', desc: 'Pick, pay with UPI, walk in. That’s the whole flow.' },
  { icon: '🎟️', title: 'Fair, transparent fees', desc: 'What you see is what you pay — no surprise charges at checkout.' },
  { icon: '📍', title: 'Local to your city', desc: 'Every listing is filtered to your city — only what you can actually attend.' },
];

const HOW: Record<'guests' | 'organizers' | 'promoters' | 'lineups', { label: string; steps: { icon: string; t: string; d: string }[] }> = {
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
};

const JOIN = [
  { icon: '🎤', title: 'Host events', desc: 'List your event, sell tickets, scan QR at the gate — payouts weekly.', cta: 'Host with us →', to: '/host' },
  { icon: '📣', title: 'Become a promoter', desc: 'Run guest lists with your own affiliate links and earn per head.', cta: 'Start promoting →', to: '/promoter/onboarding' },
  { icon: '🎧', title: 'Join as line-up', desc: 'DJs, bands and comedians — get a profile and get booked.', cta: 'Create artist profile →', to: '/lineup/onboarding' },
];

export default function Home() {
  const { city, user, carts, setSelection, following, toggleFollow } = useApp();
  const navigate = useNavigate();
  const [cat, setCat] = useState('All');
  const [howTab, setHowTab] = useState<'guests' | 'organizers' | 'promoters' | 'lineups'>('guests');
  const [dismissed, setDismissed] = useState(false);
  const [heroIdx, setHeroIdx] = useState(0);
  const [eventLimit, setEventLimit] = useState(4);

  // auto-advance the hero every 5s
  useEffect(() => {
    const t = setInterval(() => setHeroIdx((i) => (i + 1) % HERO.length), 5000);
    return () => clearInterval(t);
  }, []);

  const published = EVENTS.filter((e) => e.status === 'approved');
  const soldOf = (e: typeof EVENTS[number]) => e.tiers.reduce((a, t) => a + t.sold, 0);
  const events = (cat === 'All' ? published : published.filter((e) => e.category === cat))
    .filter((e) => venueById(e.venueId)?.city === city)
    .sort((a, b) => soldOf(b) - soldOf(a));

  // City-scoped top lists (fall back to all when a city has no seeded data yet).
  const byCity = <T extends { city: string }>(arr: T[]) => {
    const f = arr.filter((x) => x.city === city);
    return (f.length ? f : arr);
  };
  const topOrganizers = [...byCity(ORGANIZERS)].sort((a, b) => b.eventsHosted - a.eventsHosted).slice(0, 10);
  const topPromoters = [...byCity(PROMOTERS)].sort((a, b) => b.showRate - a.showRate).slice(0, 10);
  const topLineups = [...byCity(LINEUPS)].sort((a, b) => b.followers - a.followers).slice(0, 10);
  const topVenues = [...byCity(VENUES)].sort((a, b) => b.rating - a.rating).slice(0, 10);
  const cityPeople = [...byCity(PEOPLE)].sort((a, b) => b.followers - a.followers).slice(0, 10);

  const friendEvents = published
    .map((e) => ({ event: e, friends: friendsGoing(e.id, following) }))
    .filter((x) => x.friends.length > 0)
    .sort((a, b) => b.friends.length - a.friends.length);

  const resumeCart = user
    ? [...carts].filter((c) => c.userPhone === user.phone && c.status !== 'completed').sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0]
    : undefined;
  const resume = () => {
    if (!resumeCart) return;
    setSelection({ eventId: resumeCart.eventId, qty: resumeCart.qtyMap });
    navigate('/checkout');
  };

  const followBtn = (key: string) => (
    <button className={`btn btn-sm btn-block ${following.includes(key) ? 'btn-ghost' : 'btn-pri'}`} onClick={() => toggleFollow(key)}>
      {following.includes(key) ? 'Following ✓' : '+ Follow'}
    </button>
  );

  return (
    <main className="page">
      <div className="container">
        {resumeCart && !dismissed && (
          <div className="card" style={{ marginBottom: 16, display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderColor: 'var(--accent)', background: 'rgba(155,225,61,.06)' }}>
            <span style={{ fontSize: 22 }}>🛒</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="small bold">You left {resumeCart.qty} ticket{resumeCart.qty > 1 ? 's' : ''} for {resumeCart.eventTitle}</div>
              <div className="tiny muted-2">Finish before they sell out · {resumeCart.tierSummary} · ₹{resumeCart.total}</div>
            </div>
            <button className="btn btn-pri btn-sm" onClick={resume}>Resume checkout →</button>
            <button className="btn btn-ghost btn-sm" onClick={() => setDismissed(true)} aria-label="dismiss">✕</button>
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
                  <Link to={h.to} className="btn btn-pri btn-lg" style={{ marginTop: 18 }}>{h.cta}</Link>
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

        {/* Top selling events */}
        <div className="section-hd">
          <h2>Top selling events in {city}</h2>
          <Link to="/browse">See all →</Link>
        </div>
        <div className="chip-row" style={{ marginBottom: 18 }}>
          {CATEGORIES.map((c) => (
            <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div className="grid-4">
          {events.slice(0, eventLimit).map((e) => <EventCard key={e.id} event={e} />)}
        </div>
        {events.length === 0 && <div className="empty">No events in {city} yet.</div>}
        {events.length > eventLimit && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <button className="btn btn-ghost" onClick={() => setEventLimit((n) => n + 8)}>Show more events ▾</button>
          </div>
        )}
        {events.length > 4 && events.length <= eventLimit && (
          <div style={{ textAlign: 'center', marginTop: 16 }}>
            <Link to="/browse" className="btn btn-ghost">Browse all events →</Link>
          </div>
        )}

        {/* Friends going feed */}
        {friendEvents.length > 0 && (
          <section className="section">
            <div className="section-hd">
              <h2>Your friends are going 👀</h2>
              <Link to="/people">Find people →</Link>
            </div>
            <div className="grid-4">
              {friendEvents.slice(0, 4).map((x) => <EventCard key={x.event.id} event={x.event} />)}
            </div>
          </section>
        )}

        {/* People going out in the city */}
        <section className="section">
          <div className="section-hd">
            <h2>Going out in {city} 🔥</h2>
            <Link to="/people">See all people →</Link>
          </div>
          <div className="card" style={{ marginBottom: 14, display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
            <div style={{ display: 'flex' }}>
              {cityPeople.slice(0, 6).map((p, i) => (
                <span key={p.id} title={p.name} style={{ width: 34, height: 34, borderRadius: '50%', background: `hsl(${p.avatarHue} 55% 45%)`, color: '#fff', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: 14, marginLeft: i ? -10 : 0, border: '2px solid var(--bg)' }}>{p.name[0]}</span>
              ))}
            </div>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div className="bold">{cityPeople.length}+ people going out in {city}</div>
              <div className="tiny muted-2">Follow them to see which parties they’re hitting — before the tickets go.</div>
            </div>
            <Link to="/people" className="btn btn-pri btn-sm">Find your people →</Link>
          </div>
          <Slider slideWidth={244}>
            {cityPeople.map((p) => {
              const going = eventsForPerson(p.id).filter((a) => a.status === 'going').length;
              return (
                <DirectoryCard key={p.id} to={`/u/${p.username}`} hue={p.avatarHue} avatarText={p.name[0]} name={p.name} verified={p.verified} meta={`@${p.username} · ${p.city}`} bio={p.bio}
                  stats={<><b>{p.followers.toLocaleString('en-IN')}</b> followers · <b>{going}</b> going</>}
                  action={followBtn(personFollowKey(p.id))} />
              );
            })}
          </Slider>
        </section>

        {/* Reels */}
        <section className="section">
          <div className="section-hd">
            <h2>Things happening at events 🎬</h2>
            <span className="muted-2 small">‹ swipe ›</span>
          </div>
          <Slider slideWidth={150}>
            {[20, 150, 260, 330, 45, 95, 200, 285, 12, 340, 170, 60].map((hue, i) => (
              <Poster key={i} hue={hue} emoji="▶" label={`reel ${i + 1}`} variant="reel" />
            ))}
          </Slider>
        </section>

        {/* Top organizers */}
        <section className="section">
          <div className="section-hd">
            <h2>Top organizers in {city}</h2>
            <Link to="/organizers">See all →</Link>
          </div>
          <Slider slideWidth={244}>
            {topOrganizers.map((o) => {
              const live = EVENTS.filter((e) => e.organizerId === o.id && e.status === 'approved').length;
              return (
                <DirectoryCard key={o.id} to={`/organizers/${o.id}`} hue={o.logoHue} avatarText="🎧" name={o.brandName} verified={o.verified} meta={`${o.city} · ★ ${o.rating}`} bio={o.about}
                  stats={<><b>{o.eventsHosted}</b> events · <b>{live}</b> live · <b>{o.followers.toLocaleString('en-IN')}</b> followers</>}
                  action={followBtn(o.id)} />
              );
            })}
          </Slider>
        </section>

        {/* Top promoters */}
        <section className="section">
          <div className="section-hd">
            <h2>Top promoters in {city} 📣</h2>
            <Link to="/promoters">See all →</Link>
          </div>
          <Slider slideWidth={244}>
            {topPromoters.map((p) => (
              <DirectoryCard key={p.slug} to={`/promoter/${p.slug}`} hue={p.hue} avatarText="📣" name={p.name} verified={p.verified} meta={`${p.city} · ${p.followers.toLocaleString('en-IN')} followers`} bio={p.bio}
                stats={<><span className={p.showRate >= 70 ? 'accent bold' : 'bold'}>{p.showRate}%</span> show-rate · <b>{p.guestsBrought.toLocaleString('en-IN')}</b> brought</>}
                action={followBtn('promoter:' + p.slug)} />
            ))}
          </Slider>
        </section>

        {/* Top line-ups */}
        <section className="section">
          <div className="section-hd">
            <h2>Top line-ups in {city} 🎤</h2>
            <Link to="/lineups">See all →</Link>
          </div>
          <Slider slideWidth={244}>
            {topLineups.map((l) => (
              <DirectoryCard key={l.slug} to={`/lineup/${l.slug}`} hue={l.hue} avatarText={l.emoji} name={l.name} verified={l.verified} meta={`${l.category} · ${l.city}`} bio={l.bio}
                stats={<><b>{l.followers.toLocaleString('en-IN')}</b> followers · <b>{l.eventsPlayed}</b> shows</>}
                action={followBtn('lineup:' + l.slug)} />
            ))}
          </Slider>
        </section>

        {/* Trending venues */}
        <section className="section">
          <div className="section-hd">
            <h2>Top venues in {city}</h2>
            <Link to="/venues">See all →</Link>
          </div>
          <Slider slideWidth={260}>
            {topVenues.map((v) => {
              const count = EVENTS.filter((e) => e.venueId === v.id && e.status === 'approved').length;
              return (
                <Link key={v.id} to={`/venues/${v.id}`} className="ecard">
                  <Poster hue={v.photoHue} emoji="🏛" label="venue photo" variant="landscape" />
                  <div>
                    <h3>{v.name} {v.verified && <span className="verified">✓</span>}</h3>
                    <div className="meta">★ {v.rating} · {count || v.followers % 20} events · {v.type}</div>
                  </div>
                </Link>
              );
            })}
          </Slider>
        </section>

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
        <section className="section">
          <div className="section-hd">
            <h2>Happy guests 💚</h2>
            <Link to="/testimonials">Read all reviews →</Link>
          </div>
          <Slider slideWidth={300}>
            {TESTIMONIALS.map((t) => (
              <div key={t.id} className="card" style={{ display: 'flex', flexDirection: 'column' }}>
                <Stars rating={t.rating} />
                <p style={{ margin: '10px 0 12px', fontSize: 14, flex: 1 }}>"{t.quote}"</p>
                <div className="small bold">{t.author} <span className="muted-2" style={{ fontWeight: 400 }}>· {t.location}</span></div>
              </div>
            ))}
          </Slider>
        </section>

        {/* Join us */}
        <section className="section">
          <div className="section-hd"><h2>Join the Prebooze network 🚀</h2></div>
          <p className="muted small" style={{ marginTop: -6, marginBottom: 14 }}>
            Whoever you are in nightlife — there’s a way in.
          </p>
          <div className="grid-3">
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
