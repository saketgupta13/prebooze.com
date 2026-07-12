import { Link } from 'react-router-dom';
import { FAQS } from '../../data/mock';
import Accordion from '../../components/Accordion';

const ORGANIZER_FAQS = [
  {
    q: 'How do I list an event?',
    a: 'Join as an organizer from “Host with us”, complete KYC, and publish through the create-event wizard. Events go live after a quick review, usually within a day.',
  },
  {
    q: 'What commission does Prebooze charge?',
    a: 'Commission is agreed per event (typically 7–12%) plus a small per-ticket booking fee. There are no upfront or listing costs.',
  },
  {
    q: 'Can I run a free guest list?',
    a: 'Yes — every event supports a free-entry guest list for artists, press and VIPs. Guest-list entries don’t consume ticket inventory.',
  },
];

/** Standalone FAQ page — managed as a site page in the admin CMS, linked from the footer. */
export default function Faqs() {
  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <section className="hero" style={{ padding: '34px 36px', textAlign: 'center' }}>
          <h1 style={{ fontSize: 28 }}>Frequently asked questions</h1>
          <p style={{ margin: '8px auto 0' }}>
            Everything about booking, tickets, refunds and hosting. Still stuck?{' '}
            <Link to="/contact" className="link">Contact us →</Link>
          </p>
        </section>

        <section className="section">
          <div className="section-hd">
            <h2>For guests</h2>
          </div>
          {FAQS.map((f, i) => (
            <Accordion key={f.q} title={f.q} defaultOpen={i === 0}>
              {f.a}
            </Accordion>
          ))}
        </section>

        <section className="section">
          <div className="section-hd">
            <h2>For organizers</h2>
          </div>
          {ORGANIZER_FAQS.map((f) => (
            <Accordion key={f.q} title={f.q}>
              {f.a}
            </Accordion>
          ))}
        </section>

        <section className="section cta-banner">
          <div>
            <h3>Didn't find your answer?</h3>
            <p>WhatsApp support replies fastest — usually within the hour.</p>
          </div>
          <Link to="/contact" className="btn btn-pri">Get in touch →</Link>
        </section>
      </div>
    </main>
  );
}
