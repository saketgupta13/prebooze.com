import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Rocket, Mic, Landmark, BarChart3, Wallet, Ban, CalendarClock } from 'lucide-react';
import { useApp } from '../../store/AppContext';
import { useSeo } from '../../lib/useSeo';
import { organizer } from '../../api';
import type { MarketingRates } from '../../types';

const STEPS = [
  'Pick a single event, or a rolling 30-day subscription covering everything you run',
  'Prebooze creates and runs a dedicated Meta ad campaign for you',
  'Track real views, carts and bookings for that event in your own dashboard',
];

const BENEFITS = [
  { icon: BarChart3, text: 'Real performance data in your own dashboard' },
  { icon: Ban, text: 'No ad account or Meta experience needed' },
  { icon: Rocket, text: 'A dedicated campaign, not shared with anyone else' },
  { icon: CalendarClock, text: 'Flexible — pay per event, or subscribe monthly' },
  { icon: Wallet, text: 'Cancel an auto-renewing subscription any time' },
  { icon: Mic, text: 'Run by the same team behind Prebooze\'s own ad campaigns' },
];

const fmt = (n: number) => n.toLocaleString('en-IN');

/** Public, no-login pitch for the paid organizer/venue ads product
 * (MarketingService) — same "public page, CTA gates on login" shape as
 * HostLanding.tsx, reusing its layout classes (.hero/.stat3/.section/
 * .steps/.grid-3/.trust-item) rather than inventing a new visual style.
 * Real pricing comes from GET /organizer/marketing/rates, deliberately left
 * unguarded (see MarketingController) so a logged-out visitor sees real
 * numbers, not a placeholder. CTA targets: an existing organizer/venue goes
 * straight to their own Marketing tab; anyone else is sent to login with
 * `state.from` set to that same destination — the existing post-login
 * redirect (Otp.tsx) already forwards an arbitrary path verbatim, so no
 * auth-flow changes were needed for this to work. */
export default function Advertise() {
  useSeo(null, 'Advertise your event');
  const { user } = useApp();
  const [rates, setRates] = useState<MarketingRates | null>(null);

  useEffect(() => {
    organizer.marketing.rates().then(setRates).catch(() => {});
  }, []);

  const organizerTarget = user ? (user.isOrganizer ? '/organizer/marketing' : '/organizer/onboarding') : '/login';
  const venueTarget = user ? (user.isVenue ? '/venue/hosting/marketing' : '/venue/onboarding') : '/login';

  return (
    <main className="page">
      <div className="container">
        <section className="hero" style={{ textAlign: 'center' }}>
          <span className="badge badge-accent">For organizers & venues</span>
          <h1 style={{ marginTop: 12 }}>
            Boost your event with
            <br />
            dedicated ads.
          </h1>
          <p style={{ margin: '10px auto 0' }}>
            Prebooze runs a real, dedicated Meta ad campaign for your event — or a rolling 30-day
            subscription covering everything you have on sale. You pay, we run it, you see the results.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginTop: 22, flexWrap: 'wrap' }}>
            <Link to={organizerTarget} state={{ from: '/organizer/marketing' }} className="btn btn-pri btn-lg" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Mic size={16} /> Boost my event (Organizer)
            </Link>
            <Link to={venueTarget} state={{ from: '/venue/hosting/marketing' }} className="btn btn-ghost btn-lg" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Landmark size={16} /> Boost my event (Venue)
            </Link>
          </div>
        </section>

        {rates && (
          <div className="stat3" style={{ maxWidth: 720, margin: '0 auto 34px' }}>
            <div className="s">
              <div className="v accent">₹{fmt(rates.perEvent)}</div>
              <div className="l">per event, one-time</div>
            </div>
            <div className="s">
              <div className="v accent">₹{fmt(rates.monthly)}</div>
              <div className="l">every 30 days, all your events</div>
            </div>
            <div className="s">
              <div className="v accent">Real</div>
              <div className="l">Meta campaign, not a boosted post</div>
            </div>
          </div>
        )}

        <section className="section">
          <div className="section-hd">
            <h2>How it works</h2>
          </div>
          <div className="steps">
            {STEPS.map((s, i) => (
              <div key={s} className="step">
                <div className="num">{i + 1}</div>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{s}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="section">
          <div className="section-hd">
            <h2>Why organizers & venues use it</h2>
          </div>
          <div className="grid-3">
            {BENEFITS.map(({ icon: Icon, text }) => (
              <div key={text} className="trust-item" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon size={15} color="var(--accent)" style={{ flexShrink: 0 }} />
                {text}
              </div>
            ))}
          </div>
        </section>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', marginBottom: 20, flexWrap: 'wrap' }}>
          <Link to={organizerTarget} state={{ from: '/organizer/marketing' }} className="btn btn-pri btn-lg" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Mic size={16} /> Boost my event (Organizer) →
          </Link>
          <Link to={venueTarget} state={{ from: '/venue/hosting/marketing' }} className="btn btn-ghost btn-lg" style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
            <Landmark size={16} /> Boost my event (Venue) →
          </Link>
        </div>
      </div>
    </main>
  );
}
