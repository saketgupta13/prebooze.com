import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { CATEGORIES, EVENTS, FAQS, ORGANIZERS, TESTIMONIALS, TRUST_POINTS, VENUES } from '../data/mock';
import EventCard from '../components/EventCard';
import Poster from '../components/Poster';
import Accordion from '../components/Accordion';
import Stars from '../components/Stars';

export default function Home() {
  const { city } = useApp();
  const [cat, setCat] = useState('All');
  const [howTab, setHowTab] = useState<'guests' | 'organizers'>('guests');

  const published = EVENTS.filter((e) => e.status === 'approved');
  const events = cat === 'All' ? published : published.filter((e) => e.category === cat);

  return (
    <main className="page">
      <div className="container">
        {/* Hero */}
        <section className="hero">
          <span className="badge badge-accent">Featured · {city}</span>
          <h1 style={{ marginTop: 12 }}>Your city's events, one tap away</h1>
          <p>
            Concerts, comedy, festivals and warehouse parties from verified organizers — instant
            WhatsApp tickets, QR entry, zero fakes.
          </p>
          <div style={{ marginTop: 20 }}>
            <Link to="/browse" className="btn btn-pri btn-lg">
              Explore events →
            </Link>
          </div>
        </section>

        {/* Category chips + grid */}
        <div className="chip-row" style={{ marginBottom: 18 }}>
          {CATEGORIES.map((c) => (
            <button key={c} className={`chip ${cat === c ? 'on' : ''}`} onClick={() => setCat(c)}>
              {c}
            </button>
          ))}
        </div>
        <div className="grid-4">
          {events.slice(0, 4).map((e) => (
            <EventCard key={e.id} event={e} />
          ))}
        </div>
        {events.length === 0 && <div className="empty">No events in this category yet.</div>}

        {/* Reels */}
        <section className="section">
          <div className="section-hd">
            <h2>Things happening at events 🎬</h2>
            <span className="muted-2 small">‹ swipe ›</span>
          </div>
          <div className="reels">
            {[20, 150, 260, 330].map((hue) => (
              <Poster key={hue} hue={hue} emoji="▶" label="video reel 9:16" variant="reel" />
            ))}
          </div>
        </section>

        {/* About teaser */}
        <section className="section cta-banner">
          <div>
            <h3>Your city's events, one tap away</h3>
            <p>
              We connect guests with verified organizers and venues — no fake listings, no paper
              tickets.
            </p>
          </div>
          <Link to="/about" className="btn btn-ghost">
            Learn more — About us →
          </Link>
        </section>

        {/* Host banner */}
        <section className="section cta-banner">
          <div>
            <h3>Hosting an event? 🎤</h3>
            <p>List your event, sell tickets, scan QR at entry — payouts weekly.</p>
          </div>
          <Link to="/host" className="btn btn-pri">
            Host with us →
          </Link>
        </section>

        {/* Trending venues */}
        <section className="section">
          <div className="section-hd">
            <h2>Trending venues in {city}</h2>
            <Link to="/venues">Show more →</Link>
          </div>
          <div className="grid-4">
            {VENUES.slice(0, 4).map((v) => {
              const count = EVENTS.filter(
                (e) => e.venueId === v.id && e.status === 'approved'
              ).length;
              return (
                <Link key={v.id} to={`/venues/${v.id}`} className="ecard">
                  <Poster hue={v.photoHue} emoji="🏛" label="venue photo" variant="landscape" />
                  <div>
                    <h3>
                      {v.name} {v.verified && <span className="verified">✓</span>}
                    </h3>
                    <div className="meta">
                      {count || v.followers % 20} events · {v.type}
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Trending organizers */}
        <section className="section">
          <div className="section-hd">
            <h2>Trending organizers in {city}</h2>
            <Link to="/organizers/livewire">See all organizers →</Link>
          </div>
          <div className="grid-3">
            {ORGANIZERS.map((o) => (
              <Link key={o.id} to={`/organizers/${o.id}`} className="card" style={{ display: 'flex', gap: 14, alignItems: 'center' }}>
                <Poster hue={o.logoHue} emoji="🎧" variant="square" className="" />
                <div style={{ minWidth: 0 }}>
                  <h3 style={{ fontSize: 15 }}>
                    {o.brandName} {o.verified && <span className="verified">✓</span>}
                  </h3>
                  <div className="meta muted small">{o.eventsHosted} events hosted</div>
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* Trust points */}
        <section className="section">
          <div className="section-hd">
            <h2>Why book with us</h2>
          </div>
          <div className="trust-list">
            {TRUST_POINTS.map((t) => (
              <div key={t} className="trust-item">
                <span className="tick">✓</span>
                {t}
              </div>
            ))}
          </div>
        </section>

        {/* Testimonials */}
        <section className="section">
          <div className="section-hd">
            <h2>Happy guests 💚</h2>
          </div>
          <div className="grid-3">
            {TESTIMONIALS.map((t) => (
              <div key={t.id} className="card">
                <Stars rating={t.rating} />
                <p style={{ margin: '10px 0 12px', fontSize: 14 }}>"{t.quote}"</p>
                <div className="small bold">
                  {t.author} <span className="muted-2" style={{ fontWeight: 400 }}>· {t.location}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section className="section">
          <div className="section-hd">
            <h2>How it works</h2>
          </div>
          <div className="chip-row" style={{ marginBottom: 16 }}>
            <button
              className={`chip ${howTab === 'guests' ? 'on' : ''}`}
              onClick={() => setHowTab('guests')}
            >
              For guests
            </button>
            <button
              className={`chip ${howTab === 'organizers' ? 'on' : ''}`}
              onClick={() => setHowTab('organizers')}
            >
              For organizers
            </button>
          </div>
          <div className="steps">
            {(howTab === 'guests'
              ? [
                  'Find an event in your city',
                  'Login with WhatsApp OTP',
                  'Pay & get QR ticket',
                  'Scan at entry, enjoy 🎉',
                ]
              : [
                  'Create your event & set tickets',
                  'Get verified & go live',
                  'Guests discover & book instantly',
                  'Scan QR at gate, get paid weekly',
                ]
            ).map((s, i) => (
              <div key={s} className="step">
                <div className="num">{i + 1}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s}</div>
              </div>
            ))}
          </div>
        </section>

        {/* FAQs */}
        <section className="section" id="faqs">
          <div className="section-hd">
            <h2>FAQs</h2>
          </div>
          {FAQS.map((f, i) => (
            <Accordion key={f.q} title={f.q} defaultOpen={i === 0}>
              {f.a}
            </Accordion>
          ))}
        </section>
      </div>
    </main>
  );
}
