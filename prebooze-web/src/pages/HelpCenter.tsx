import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useApp } from '../store/AppContext';
import { FAQS } from '../data/mock';
import Accordion from '../components/Accordion';

const TOPICS = ['Booking & tickets', 'Refunds & wallet', 'Guest lists', 'Payments', 'Account & login', 'Organizer / promoter', 'Something else'];

/** Help center — quick answers + raise a support ticket. */
export default function HelpCenter() {
  const { user, helpTickets, addHelpTicket, toast } = useApp();
  const [topic, setTopic] = useState(TOPICS[0]);
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !message.trim()) {
      toast('Subject and message are required');
      return;
    }
    addHelpTicket({ topic, subject: subject.trim(), message: message.trim() });
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
        <p className="muted" style={{ marginBottom: 22 }}>
          Quick answers below — or raise a ticket and we'll get back on WhatsApp.
        </p>

        <div className="card" style={{ marginBottom: 18 }}>
          <h3 style={{ marginBottom: 10 }}>Raise a ticket</h3>
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
                    {TOPICS.map((t) => <option key={t}>{t}</option>)}
                  </select>
                </div>
                <div className="field">
                  <span>Subject</span>
                  <input value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="One line about the issue" />
                </div>
              </div>
              <div className="field">
                <span>What happened?</span>
                <textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Tell us the details — booking id helps if it's about a ticket…" />
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
          <h3 style={{ marginBottom: 10 }}>Common questions</h3>
          {FAQS.map((f) => (
            <Accordion key={f.q} title={f.q}>{f.a}</Accordion>
          ))}
        </div>
      </div>
    </main>
  );
}
