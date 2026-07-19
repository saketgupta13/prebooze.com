import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { existingRole } from '../lib/roles';
import Accordion from '../components/Accordion';

type HelpRole = 'guest' | 'organizer' | 'promoter' | 'lineup' | 'venue';

const HELP: Record<HelpRole, { label: string; icon: string; topics: string[]; faqs: { q: string; a: string }[] }> = {
  guest: {
    label: 'Guest', icon: '🎟️',
    topics: ['Booking & tickets', 'Refunds & wallet', 'Guest lists', 'Payments', 'Account & login', 'Something else'],
    faqs: [
      { q: 'How do I get my ticket?', a: 'It lands on your WhatsApp instantly after payment — also downloadable as a PNG from My Bookings.' },
      { q: 'How do refunds work?', a: 'Cancel from My Bookings and choose: instant Prebooze wallet credit, or back to your payment method in 5–7 days.' },
      { q: 'What is the free guest list?', a: 'Promoters run free-entry lists with a time cutoff. Join via their link, get a rotating QR, arrive before the cutoff.' },
      { q: 'The event is sold out — now what?', a: 'Join the waitlist on the event page. Freed spots are offered first-come first-served.' },
    ],
  },
  organizer: {
    label: 'Organizer', icon: '🎤',
    topics: ['Event approval', 'Payouts & withdrawals', 'Scanner & check-in', 'Promoter guest lists', 'Featured placement', 'Something else'],
    faqs: [
      { q: 'When do I get paid?', a: 'Weekly auto-payouts every Monday, with per-event settlement after the event completes. Track it under Payouts.' },
      { q: 'Why is my event pending?', a: 'Every event is reviewed by the Prebooze team — usually within a day. Edits re-trigger review.' },
      { q: 'How do promoter payouts work?', a: 'You pay promoters directly: per-head on verified arrivals plus gate commission. See Payouts → Promoter payouts.' },
      { q: 'How do I get featured on the home page?', a: 'Use "Feature this event" in My Events (per-event) or the Promote panel on your dashboard (monthly). Admin approves before it goes live.' },
    ],
  },
  promoter: {
    label: 'Promoter', icon: '📣',
    topics: ['Guest lists & links', 'Earnings & payouts', 'Subscription & quota', 'Team / sub-promoters', 'Something else'],
    faqs: [
      { q: 'How do I earn?', a: 'The organizer pays you per verified arrival, plus a gate commission when a listed guest arrives after the cutoff and buys a ticket.' },
      { q: 'What happens when I hit my monthly quota?', a: 'New guests can’t join your lists until the month resets or you upgrade your plan under Subscription.' },
      { q: 'How do team links work?', a: 'Add sub-promoters under Team — each gets a tagged link (?via=handle) so arrivals stay attributed per member.' },
      { q: 'Why was a guest blocked from my list?', a: 'Phones with 3+ past no-shows are auto-blocked to protect your show-rate.' },
    ],
  },
  lineup: {
    label: 'Line-up', icon: '🎸',
    topics: ['Profile & verification', 'Event tags', 'Featured placement', 'Something else'],
    faqs: [
      { q: 'How do I get tagged in events?', a: 'Organizers add you to their line-up during event creation. Tagged events appear on your artist dashboard.' },
      { q: 'How do I get the verified badge?', a: 'Complete ID verification during onboarding — admin review usually lands within a day.' },
      { q: 'Can I promote my profile?', a: 'Yes — "Get featured" on your artist dashboard puts you at the front of the line-ups slider for your city (monthly).' },
    ],
  },
  venue: {
    label: 'Venue partner', icon: '🏛',
    topics: ['Listing & verification', 'Event hosting', 'License & documents', 'Something else'],
    faqs: [
      { q: 'How do I list my venue?', a: 'Organizers can add venues during event creation, or write to partners@prebooze.com for a managed listing with photos and amenities.' },
      { q: 'What documents do I need?', a: 'A valid operating license and address proof. Admin reviews and marks the venue verified.' },
      { q: 'How do guests find my venue?', a: 'Verified venues appear in the city venue directory, on event pages, and in the home Top-venues slider.' },
    ],
  },
};

/** Help center — role-aware topics, FAQs and support tickets. */
export default function HelpCenter() {
  const { user, helpTickets, addHelpTicket, toast } = useApp();
  const myRole = (existingRole(user) ?? 'guest') as HelpRole;
  const [role, setRole] = useState<HelpRole>(myRole);
  const effectiveRole = user ? myRole : role; // logged-in users only ever see their own role
  const help = HELP[effectiveRole];
  const [topic, setTopic] = useState(help.topics[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const pickRole = (r: HelpRole) => {
    setRole(r);
    setTopic(HELP[r].topics[0]);
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast('Subject and message are required');
      return;
    }
    addHelpTicket({ topic: `${help.label} · ${topic}`, subject: subject.trim(), message: message.trim() });
    toast('Ticket raised — we usually reply within a few hours ✓');
    setSubject('');
    setMessage('');
  };

  return (
    <main className="page">
      <div className="container" style={{ maxWidth: 760 }}>
        <div className="breadcrumb">
          <Link to="/">Home</Link> / Help center
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4 }}>Help center 🛟</h1>
        <p className="muted" style={{ marginBottom: 14 }}>
          {user ? (
            <>Help for your account — <b className="accent">{HELP[myRole].icon} {HELP[myRole].label}</b>.</>
          ) : (
            'Pick who you are for the right answers.'
          )}
        </p>

        {!user && (
          <div className="chip-row" style={{ marginBottom: 18 }}>
            {(Object.keys(HELP) as HelpRole[]).map((r) => (
              <button key={r} className={`chip ${role === r ? 'on' : ''}`} onClick={() => pickRole(r)}>
                {HELP[r].icon} {HELP[r].label}
              </button>
            ))}
          </div>
        )}

        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 10 }}>Raise a ticket <span className="badge badge-accent">{help.icon} {help.label}</span></h3>
          {!user ? (
            <div className="muted small">
              <Link to="/login" className="link bold">Log in</Link> to raise a ticket — we reply on your WhatsApp number.
            </div>
          ) : (
            <form onSubmit={submit}>
              <div className="form-row">
                <div className="field">
                  <span>Topic</span>
                  <select value={topic} onChange={(e) => setTopic(e.target.value)}>
                    {help.topics.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="field">
                  <span>Subject</span>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="One line about the issue" />
                </div>
              </div>
              <div className="field">
                <span>What happened?</span>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us the details — ids help (booking / event / payout)…" />
              </div>
              <button className="btn btn-pri">Submit ticket →</button>
              <span className="tiny muted-2" style={{ marginLeft: 10 }}>replies land on WhatsApp {user.phone}</span>
            </form>
          )}
        </div>

        {user && helpTickets.length > 0 && (
          <div className="card" style={{ marginBottom: 18 }}>
            <h3 style={{ marginBottom: 10 }}>Your tickets ({helpTickets.length})</h3>
            {helpTickets.map((t) => (
              <div key={t.id} className="evrow">
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="bold small">{t.subject} <span className="muted" style={{ fontWeight: 400 }}>· {t.id}</span></div>
                  <div className="tiny muted-2">{t.topic} · {new Date(t.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
                </div>
                {t.status === 'open' ? (
                  <span className="badge badge-pending">Open ◌</span>
                ) : (
                  <span className="badge badge-ok">Resolved ✓</span>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="card">
          <h3 style={{ marginBottom: 10 }}>{help.icon} {help.label} — common questions</h3>
          {help.faqs.map((f) => (
            <Accordion key={f.q} title={f.q}>{f.a}</Accordion>
          ))}
        </div>
      </div>
    </main>
  );
}
