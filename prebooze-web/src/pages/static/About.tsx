import { Link } from 'react-router-dom';
import { useSeo } from '../../lib/useSeo';

export default function About() {
  useSeo(null, 'About us');
  return (
    <main className="page">
      <div className="container">
        <section className="hero" style={{ textAlign: 'center' }}>
          <h1>We're building the easiest way to find your next night out</h1>
          <p style={{ margin: '10px auto 0' }}>
            Prebooze connects guests with verified organizers and venues — from indie gigs to
            warehouse raves — with instant WhatsApp tickets and no fake listings.
          </p>
        </section>

        <div className="steps" style={{ maxWidth: 860, margin: '0 auto 40px' }}>
          {[
            ['2023', 'Founded'],
            ['18', 'Cities'],
            ['4,200+', 'Events hosted'],
            ['900+', 'Verified organizers'],
          ].map(([v, l]) => (
            <div key={l} className="step center">
              <div style={{ fontSize: 26, fontWeight: 800 }} className="accent">
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
              ['Trust first', 'Every organizer is KYC-verified before a single ticket is sold.'],
              ['No fake listings', 'Real events, real venues, real QR entry — or your money back.'],
              ['Fair for organizers', 'Low fees, weekly payouts and tools that actually help you sell.'],
            ].map(([t, d]) => (
              <div key={t} className="card">
                <h3 style={{ marginBottom: 6 }}>{t}</h3>
                <p className="muted small">{d}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="section cta-banner">
          <div>
            <h3>Hosting an event?</h3>
            <p>Join 900+ organizers already earning with Prebooze</p>
          </div>
          <Link to="/host" className="btn btn-pri">
            Host with us →
          </Link>
        </section>
      </div>
    </main>
  );
}
