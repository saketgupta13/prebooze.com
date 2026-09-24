import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { existingRole } from '../lib/roles';
import { support, auth } from '../api';
import { ApiError } from '../api/client';
import Accordion from '../components/Accordion';
import RoleConsoleFrame from '../components/RoleConsoleFrame';
import type { HelpTicket } from '../types';
import type { ReactNode } from 'react';
import { Ticket, Mic, Megaphone, Guitar, Landmark, LifeBuoy, CheckCircle2, Mail, ChevronDown, ChevronUp, Send } from 'lucide-react';

type HelpRole = 'guest' | 'organizer' | 'promoter' | 'lineup' | 'venue';

const HELP: Record<HelpRole, { label: string; icon: ReactNode; topics: string[]; faqs: { q: string; a: string }[] }> = {
  guest: {
    label: 'Guest', icon: <Ticket size={14} />,
    topics: ['Booking & tickets', 'Refunds & wallet', 'Guest lists', 'Payments', 'Account & login', 'Something else'],
    faqs: [
      { q: 'How do I get my ticket?', a: 'It lands on your WhatsApp instantly after payment — also downloadable as a PNG from My Bookings.' },
      { q: 'How do refunds work?', a: 'Cancel from My Bookings and choose: instant Prebooze wallet credit, or back to your payment method in 5–7 days.' },
      { q: 'What is the free guest list?', a: 'Promoters run free-entry lists with a time cutoff. Join via their link, get a rotating QR, arrive before the cutoff.' },
      { q: 'The event is sold out — now what?', a: 'Join the waitlist on the event page. Freed spots are offered first-come first-served.' },
    ],
  },
  organizer: {
    label: 'Organizer', icon: <Mic size={14} />,
    topics: ['Event approval', 'Payouts & withdrawals', 'Scanner & check-in', 'Promoter guest lists', 'Featured placement', 'Something else'],
    faqs: [
      { q: 'When do I get paid?', a: 'Weekly auto-payouts every Monday, with per-event settlement after the event completes. Track it under Payouts.' },
      { q: 'Why is my event pending?', a: 'Every event is reviewed by the Prebooze team — usually within a day. Edits re-trigger review.' },
      { q: 'How do promoter payouts work?', a: 'You pay promoters directly: per-head on verified arrivals plus gate commission. See Payouts → Promoter payouts.' },
      { q: 'How do I get featured on the home page?', a: 'Use "Feature this event" in My Events (per-event) or the Promote panel on your dashboard (monthly). Admin approves before it goes live.' },
    ],
  },
  promoter: {
    label: 'Promoter', icon: <Megaphone size={14} />,
    topics: ['Guest lists & links', 'Earnings & payouts', 'Subscription & quota', 'Team / sub-promoters', 'Something else'],
    faqs: [
      { q: 'How do I earn?', a: 'The organizer pays you per verified arrival, plus a gate commission when a listed guest arrives after the cutoff and buys a ticket.' },
      { q: 'What happens when I hit my monthly quota?', a: 'New guests can’t join your lists until the month resets or you upgrade your plan under Subscription.' },
      { q: 'How do team links work?', a: 'Add sub-promoters under Team — each gets a tagged link (?via=handle) so arrivals stay attributed per member.' },
      { q: 'Why was a guest blocked from my list?', a: 'Phones with 3+ past no-shows are auto-blocked to protect your show-rate.' },
    ],
  },
  lineup: {
    label: 'Line-up', icon: <Guitar size={14} />,
    topics: ['Profile & verification', 'Event tags', 'Featured placement', 'Something else'],
    faqs: [
      { q: 'How do I get tagged in events?', a: 'Organizers add you to their line-up during event creation. Tagged events appear on your artist dashboard.' },
      { q: 'How do I get the verified badge?', a: 'Complete ID verification during onboarding — admin review usually lands within a day.' },
      { q: 'Can I promote my profile?', a: 'Yes — "Get featured" on your artist dashboard puts you at the front of the line-ups slider for your city (monthly).' },
    ],
  },
  venue: {
    label: 'Venue partner', icon: <Landmark size={14} />,
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
  const { user, updateUser, helpTickets, addHelpTicket, toast } = useApp();
  const myRole = (existingRole(user) ?? 'guest') as HelpRole;
  const [role, setRole] = useState<HelpRole>(myRole);
  const effectiveRole = user ? myRole : role; // logged-in users only ever see their own role
  const help = HELP[effectiveRole];
  const [topic, setTopic] = useState(help.topics[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');
  const [openId, setOpenId] = useState<string | null>(null);

  const [addingEmail, setAddingEmail] = useState(false);
  const [emailDraft, setEmailDraft] = useState('');
  const [savingEmail, setSavingEmail] = useState(false);

  // Real bug (2026-09-24): this used to link to /profile/edit — the guest
  // personal-profile form (dob/gender/profession/bio/interests), completely
  // wrong to send an organizer/promoter/lineup/venue through just to add an
  // email. Made inline instead, matching the RN organizer app's fix for the
  // same gap. Also: this is User.email (your own account login email, used
  // for ticket replies) — a different field from an organizer's public
  // Organizer.contact ("Business email" under Settings → Brand profile),
  // which this flow must never be confused with.
  const saveEmail = async () => {
    if (!emailDraft.trim()) return;
    setSavingEmail(true);
    try {
      const updated = await auth.updateMe({ email: emailDraft.trim() });
      updateUser(updated);
      setAddingEmail(false);
      setEmailDraft('');
    } catch (e) {
      toast(e instanceof ApiError ? e.message : 'Failed to save email');
    } finally {
      setSavingEmail(false);
    }
  };

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
      <RoleConsoleFrame maxWidth={760}>
        <div className="breadcrumb">
          <Link to="/">Home</Link> / Help center
        </div>
        <h1 style={{ fontSize: 26, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 8 }}>Help center <LifeBuoy size={22} /></h1>
        <p className="muted" style={{ marginBottom: 14 }}>
          {user ? (
            <>Help for your account — <b className="accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{HELP[myRole].icon} {HELP[myRole].label}</b>.</>
          ) : (
            'Pick who you are for the right answers.'
          )}
        </p>

        {!user && (
          <div className="chip-row" style={{ marginBottom: 18 }}>
            {(Object.keys(HELP) as HelpRole[]).map((r) => (
              <button key={r} className={`chip ${role === r ? 'on' : ''}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => pickRole(r)}>
                {HELP[r].icon} {HELP[r].label}
              </button>
            ))}
          </div>
        )}

        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>Raise a ticket <span className="badge badge-accent" style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>{help.icon} {help.label}</span></h3>
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
              <span className="tiny muted-2" style={{ marginLeft: 10 }}>
                {user.email?.trim() ? `replies land at ${user.email}` : 'add an email below to get replies'}
              </span>
            </form>
          )}
        </div>

        {user && !user.email?.trim() && (
          <div className="card" style={{ marginBottom: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <Mail size={18} className="accent" />
              <div style={{ flex: 1, minWidth: 200 }}>
                <div className="bold small">Add your email to get ticket updates</div>
                <div className="tiny muted-2">
                  This is your own account email (we reply here when your ticket status changes) — not your business email, which is
                  under Settings → Brand profile.
                </div>
              </div>
              {!addingEmail && (
                <button className="btn btn-ghost btn-sm" onClick={() => setAddingEmail(true)}>Add email →</button>
              )}
            </div>
            {addingEmail && (
              <div className="form-row" style={{ marginTop: 10 }}>
                <div className="field" style={{ flex: 1 }}>
                  <input value={emailDraft} onChange={(e) => setEmailDraft(e.target.value)} placeholder="you@example.com" type="email" />
                </div>
                <button className="btn btn-pri btn-sm" disabled={savingEmail || !emailDraft.trim()} onClick={saveEmail}>
                  {savingEmail ? 'Saving…' : 'Save email'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={() => { setAddingEmail(false); setEmailDraft(''); }}>Cancel</button>
              </div>
            )}
          </div>
        )}

        {user && helpTickets.length > 0 && (
          <div className="card" style={{ marginBottom: 18 }}>
            <h3 style={{ marginBottom: 10 }}>Your tickets ({helpTickets.length})</h3>
            {helpTickets.map((t) => (
              <TicketRow key={t.id} ticket={t} open={openId === t.id} onToggle={() => setOpenId(openId === t.id ? null : t.id)} toast={toast} />
            ))}
          </div>
        )}

        <div className="card">
          <h3 style={{ marginBottom: 10, display: 'flex', alignItems: 'center', gap: 8 }}>{help.icon} {help.label} — common questions</h3>
          {help.faqs.map((f) => (
            <Accordion key={f.q} title={f.q}>{f.a}</Accordion>
          ))}
        </div>
      </RoleConsoleFrame>
    </main>
  );
}

/** A ticket row that opens into its full thread — previously a static list
 * item with no way to see a reply or follow up (the real gap that prompted
 * this). Thread is fetched lazily on first open, not eagerly for every
 * ticket in the list. */
function TicketRow({ ticket, open, onToggle, toast }: { ticket: HelpTicket; open: boolean; onToggle: () => void; toast: (m: string) => void }) {
  const [thread, setThread] = useState<HelpTicket | null>(null);
  const [loading, setLoading] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);

  const handleToggle = () => {
    onToggle();
    if (!open && !thread) {
      setLoading(true);
      support.ticket(ticket.id).then(setThread).catch(() => toast('Could not load this ticket')).finally(() => setLoading(false));
    }
  };

  const sendReply = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reply.trim() || !thread) return;
    setSending(true);
    support
      .reply(ticket.id, reply.trim())
      .then((r) => {
        setThread({ ...thread, replies: [...(thread.replies ?? []), r] });
        setReply('');
      })
      .catch((err) => toast((err as Error).message ?? 'Could not send your reply'))
      .finally(() => setSending(false));
  };

  return (
    <div style={{ borderBottom: '1px solid var(--border)' }}>
      <button
        onClick={handleToggle}
        style={{ all: 'unset', display: 'flex', alignItems: 'center', gap: 10, width: '100%', cursor: 'pointer', padding: '10px 0', boxSizing: 'border-box' }}
      >
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="bold small">{ticket.subject} <span className="muted" style={{ fontWeight: 400 }}>· {ticket.id}</span></div>
          <div className="tiny muted-2">{ticket.topic} · {new Date(ticket.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</div>
        </div>
        {ticket.status === 'open' ? (
          <span className="badge badge-pending">Open ◌</span>
        ) : (
          <span className="badge badge-ok" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>Resolved <CheckCircle2 size={13} /></span>
        )}
        {open ? <ChevronUp size={16} className="muted" /> : <ChevronDown size={16} className="muted" />}
      </button>

      {open && (
        <div style={{ padding: '0 0 14px 0' }}>
          {loading ? (
            <div className="tiny muted-2">Loading…</div>
          ) : !thread ? (
            <div className="tiny muted-2">Could not load this ticket.</div>
          ) : (
            <>
              <div className="tiny" style={{ background: 'var(--surface-2)', borderRadius: 8, padding: '8px 12px', marginBottom: 8 }}>{thread.message}</div>
              {(thread.replies ?? []).map((r) => (
                <div
                  key={r.id}
                  className="tiny"
                  style={{
                    borderRadius: 8,
                    padding: '8px 12px',
                    marginBottom: 8,
                    background: r.fromStaffId ? 'rgba(155, 225, 61, 0.1)' : 'var(--surface-2)',
                  }}
                >
                  <div className="muted-2" style={{ fontWeight: 700, marginBottom: 2 }}>{r.fromStaffId ? `Prebooze team${r.fromStaff?.name ? ` · ${r.fromStaff.name}` : ''}` : 'You'}</div>
                  {r.message}
                </div>
              ))}
              {thread.status === 'open' ? (
                <form onSubmit={sendReply} style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                  <input value={reply} onChange={(e) => setReply(e.target.value)} placeholder="Write a follow-up…" style={{ flex: 1 }} />
                  <button className="btn btn-pri btn-sm" disabled={sending} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
                    <Send size={13} /> Send
                  </button>
                </form>
              ) : (
                <div className="tiny muted-2" style={{ marginTop: 6 }}>This ticket is resolved — raise a new one if you need more help.</div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
