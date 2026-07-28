import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { useSeo } from '../../lib/useSeo';

const EARN_STEPS = [
  'Create your event & set ticket tiers',
  'Get verified & go live after quick review',
  'Guests discover & book instantly',
  'Scan QR at the gate, get paid weekly',
];

const BENEFITS = [
  'No upfront cost — pay only on sales',
  'Coupon codes & guest-list tools',
  'Real-time dashboard & analytics',
  'Fraud-proof QR + photo-ID entry',
  'Discovery placement in your city',
  'Dedicated organizer support',
];

export default function HostLanding() {
  useSeo(null, 'Host with us');
  const { user } = useApp();
  const joinTarget = user
    ? user.isOrganizer
      ? '/organizer'
      : '/organizer/onboarding'
    : '/login';
  const venueJoinTarget = user
    ? user.isVenue
      ? '/venue'
      : '/venue/onboarding'
    : '/login';

  return (
    <main className="page">
      <div className="container">
        <section className="hero" style={{ textAlign: 'center' }}>
          <span className="badge badge-accent">For organizers & venues</span>
          <h1 style={{ marginTop: 12 }}>
            Turn your events into income.
            <br />
            Host with Prebooze.
          </h1>
          <p style={{ margin: '10px auto 0' }}>
            List an event in minutes, get discovered by thousands of guests, and get paid out
            weekly — with WhatsApp tickets and QR check-in built in.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 22, flexWrap: 'wrap' }}>
            <Link to={joinTarget} state={{ from: '/organizer/onboarding' }} className="btn btn-pri btn-lg">
              🎤 Join as Organizer
            </Link>
            <Link to={venueJoinTarget} state={{ from: '/venue/onboarding' }} className="btn btn-ghost btn-lg">
              🏛 Join as Venue
            </Link>
            <Link to="/lineup/onboarding" className="btn btn-ghost btn-lg">
              🎤 Join as Artist / Line-up
            </Link>
            <Link to="/promoter/onboarding" className="btn btn-ghost btn-lg">
              📣 Join as Promoter / PR
            </Link>
          </div>
        </section>

        <div className="stat3" style={{ maxWidth: 720, margin: '0 auto 34px' }}>
          <div className="s">
            <div className="v accent">₹4.2L+</div>
            <div className="l">avg. monthly payout (top organizers)</div>
          </div>
          <div className="s">
            <div className="v accent">2–3%</div>
            <div className="l">platform fee only</div>
          </div>
          <div className="s">
            <div className="v accent">Weekly</div>
            <div className="l">automatic payouts</div>
          </div>
        </div>

        <section className="section">
          <div className="section-hd">
            <h2>How you earn</h2>
          </div>
          <div className="steps">
            {EARN_STEPS.map((s, i) => (
              <div key={s} className="step">
                <div className="num">{i + 1}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-hd">
            <h2>Why organizers choose Prebooze</h2>
          </div>
          <div className="grid-3">
            {BENEFITS.map((b) => (
              <div key={b} className="trust-item">
                <span className="tick">✓</span>
                {b}
              </div>
            ))}
          </div>
        </section>

        <section className="section card" style={{ maxWidth: 620, margin: '34px auto', textAlign: 'center' }}>
          <div className="bold">
            LiveWire Ent. <span className="verified">✓</span>{' '}
            <span className="muted small">· 24 events hosted</span>
          </div>
          <p className="muted" style={{ marginTop: 8 }}>
            “We moved our whole ticketing to Prebooze — payouts land every Monday and check-in at
            the gate takes seconds.”
          </p>
        </section>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <Link to={joinTarget} state={{ from: '/organizer/onboarding' }} className="btn btn-pri btn-lg">
            🎤 Join as Organizer →
          </Link>
          <Link to={venueJoinTarget} state={{ from: '/venue/onboarding' }} className="btn btn-ghost btn-lg">
            🏛 Join as Venue →
          </Link>
        </div>
      </div>
    </main>
  );
}
