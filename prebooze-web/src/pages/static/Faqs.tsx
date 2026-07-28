import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FAQS } from '../../data/mock';
import { content } from '../../api';
import { isBackendEnabled } from '../../api/client';
import type { CmsFaq } from '../../types';
import Accordion from '../../components/Accordion';
import { useSeo } from '../../lib/useSeo';

// Offline/dev-mode fallback only — real copy comes from GET /faqs?audience=
// organizers (Admin > Content > FAQs) below. Was a separate hardcoded array
// with no admin equivalent at all before; the real FaqItem model already
// supports both audiences (see admin's Faqs.tsx guests/organizers tabs).
const ORGANIZER_FAQS_FALLBACK = [
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

/** Standalone FAQ page — real GET /faqs?audience=guests|organizers (admin's
 * Content > FAQs), not the hardcoded mock arrays. */
export default function Faqs() {
  useSeo(null, 'FAQs');
  const [liveGuest, setLiveGuest] = useState<CmsFaq[] | null>(null);
  const [liveOrg, setLiveOrg] = useState<CmsFaq[] | null>(null);
  useEffect(() => {
    if (!isBackendEnabled()) return;
    content.faqs('guests').then(setLiveGuest).catch(() => setLiveGuest([]));
    content.faqs('organizers').then(setLiveOrg).catch(() => setLiveOrg([]));
  }, []);
  const guestFaqs = liveGuest ?? (isBackendEnabled() ? [] : FAQS.map((f) => ({ id: f.q, question: f.q, answer: f.a })));
  const orgFaqs = liveOrg ?? (isBackendEnabled() ? [] : ORGANIZER_FAQS_FALLBACK.map((f) => ({ id: f.q, question: f.q, answer: f.a })));
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
          {guestFaqs.map((f, i) => (
            <Accordion key={f.id} title={f.question} defaultOpen={i === 0}>
              {f.answer}
            </Accordion>
          ))}
        </section>

        <section className="section">
          <div className="section-hd">
            <h2>For organizers</h2>
          </div>
          {orgFaqs.map((f) => (
            <Accordion key={f.id} title={f.question}>
              {f.answer}
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
