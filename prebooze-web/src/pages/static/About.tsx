import { Link } from 'react-router-dom';
import { Ticket, Tent, Landmark, Headphones } from 'lucide-react';
import { useSeo } from '../../lib/useSeo';

export default function About() {
  useSeo(null, 'About us');
  return (
    <main className="page">
      <div className="container">
        <section className="hero" style={{ textAlign: 'center' }}>
          <h1>We're building the easiest way to find your next night out</h1>
          <p style={{ margin: '10px auto 0', maxWidth: 640 }}>
            Prebooze connects guests with verified organizers, venues and performers — from indie
            gigs to warehouse raves — with instant WhatsApp tickets, QR entry and no fake listings.
          </p>
        </section>

        <div className="steps" style={{ maxWidth: 860, margin: '0 auto 40px' }}>
          {[
            ['India', 'Where we operate'],
            ['WhatsApp', 'Tickets delivered instantly'],
            ['0 fake events', 'Every listing manually reviewed'],
            ['24/7', 'Book any time, no queues'],
          ].map(([v, l]) => (
            <div key={l} className="step center">
              <div style={{ fontSize: 22, fontWeight: 800 }} className="accent">
                {v}
              </div>
              <div className="muted small">{l}</div>
            </div>
          ))}
        </div>

        <section className="section">
          <div className="section-hd">
            <h2>What we believe</h2>
          </div>
          <div className="grid-3">
            {[
              ['Trust first', 'Every organizer, venue and line-up is verified before they can list a single event.'],
              ['No fake listings', 'Real events, real venues, real QR entry — every event is reviewed before it goes live.'],
              ['Fair for organizers', 'Commission negotiated on your terms — not a fixed slab forced on everyone — plus weekly payouts.'],
            ].map(([t, d]) => (
              <div key={t} className="card">
                <h3 style={{ marginBottom: 6 }}>{t}</h3>
                <p className="muted small">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-hd">
            <h2>How booking works</h2>
          </div>
          <div className="grid-3">
            {[
              ['1. Find your event', 'Browse by city, category or search — every listing is from a verified organizer at a verified venue.'],
              ['2. Book in seconds', 'Pick your tickets, pay by UPI, card or netbanking. New guests only need a name and date of birth to get started.'],
              ['3. Ticket lands on WhatsApp', 'A QR ticket arrives instantly on WhatsApp and by email — no app to download, no PDF to dig up at the gate.'],
            ].map(([t, d]) => (
              <div key={t} className="card">
                <h3 style={{ marginBottom: 6 }}>{t}</h3>
                <p className="muted small">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-hd">
            <h2>Everything on the platform</h2>
          </div>
          <div className="grid-2">
            <div className="card">
              <h3 style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><Ticket size={18} /> For guests</h3>
              <ul className="muted small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
                <li>Fast checkout — name and date of birth to start, everything else optional</li>
                <li>WhatsApp + email tickets with QR entry</li>
                <li>Real reviews and public profiles for organizers, venues and performers</li>
                <li>Follow organizers, venues and line-ups; see who's going with friends</li>
                <li>Refer a friend — ₹100 off for them, ₹100 back to you</li>
                <li>One-time 10% off reward for completing your profile</li>
                <li>Wallet credit, saved payment methods and a full booking history</li>
              </ul>
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><Tent size={18} /> For organizers</h3>
              <ul className="muted small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
                <li>Commission negotiated with our team — no fixed slab forced on every event</li>
                <li>Real Razorpay payouts, weekly by default, with a downloadable invoice trail</li>
                <li>Live sales dashboard, QR check-in and a real-time guest list at the door</li>
                <li>Your own promoter program — recruit a street team on tracked commission</li>
                <li>Automatic WhatsApp nudges to recover abandoned carts</li>
                <li>Create your own coupon codes for your own promos</li>
                <li>Add staff with role-based access — door, marketing, finance</li>
                <li>A public organizer profile with a verified badge and real followers</li>
              </ul>
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><Landmark size={18} /> For venues</h3>
              <ul className="muted small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
                <li>Free listing, live the same day you apply</li>
                <li>Discovered directly by organizers browsing the directory</li>
                <li>Zero commission on your venue booking — that's between you and the organizer</li>
                <li>A public page with a real photo gallery and real guest reviews</li>
                <li>Every booking made at your space lands on your dashboard automatically</li>
              </ul>
            </div>
            <div className="card">
              <h3 style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}><Headphones size={18} /> For artists, DJs &amp; performers</h3>
              <ul className="muted small" style={{ margin: 0, paddingLeft: 18, display: 'grid', gap: 6 }}>
                <li>Free public profile — name, genre, bio, press shot and links</li>
                <li>Found directly by organizers building a lineup</li>
                <li>Zero commission on your booking fee</li>
                <li>Real followers, not vanity numbers</li>
                <li>Every gig you're billed on lands on your dashboard automatically</li>
              </ul>
            </div>
          </div>
        </section>

        <section className="section cta-banner">
          <div>
            <h3>Hosting an event, running a venue, or performing?</h3>
            <p>List free and get discovered by the people already looking for you.</p>
          </div>
          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <Link to="/host" className="btn btn-pri">
              Host with us →
            </Link>
            <Link to="/venue/onboarding" className="btn btn-ghost">
              List a venue →
            </Link>
            <Link to="/lineup/onboarding" className="btn btn-ghost">
              Join as a line-up →
            </Link>
          </div>
        </section>
      </div>
    </main>
  );
}
