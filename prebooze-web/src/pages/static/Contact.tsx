import { useState } from 'react';
import { usePlatformInfo } from '../../lib/usePlatformInfo';
import { useSeo } from '../../lib/useSeo';
import { support } from '../../api';
import { ApiError } from '../../api/client';

export default function Contact() {
  useSeo(null, 'Contact');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState('Guest');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const [sent, setSent] = useState(false);
  const { contact } = usePlatformInfo();

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await support.contact({ name: name.trim(), email: email.trim(), role, message: message.trim() });
      setSent(true);
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : "Couldn't send your message — please try again");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="page">
      <div className="container profile-grid">
        <form className="card" onSubmit={submit}>
          <h1 style={{ fontSize: 24 }}>Get in touch</h1>
          <p className="muted small" style={{ margin: '6px 0 18px' }}>
            Questions about a booking, hosting, or partnerships — we usually reply within a day.
          </p>
          <div className="field">
            <span>Full name</span>
            <input required placeholder="Full name" value={name} onChange={(e) => setName(e.target.value)} disabled={sent} />
          </div>
          <div className="field">
            <span>Email</span>
            <input required type="email" placeholder="you@mail.com" value={email} onChange={(e) => setEmail(e.target.value)} disabled={sent} />
          </div>
          <div className="field">
            <span>I am a…</span>
            <select value={role} onChange={(e) => setRole(e.target.value)} disabled={sent}>
              <option>Guest</option>
              <option>Organizer</option>
              <option>Press</option>
            </select>
          </div>
          <div className="field">
            <span>Message</span>
            <textarea required placeholder="How can we help?" value={message} onChange={(e) => setMessage(e.target.value)} disabled={sent} />
          </div>
          {err && (
            <div className="danger-text small" style={{ marginBottom: 12 }}>
              ✕ {err}
            </div>
          )}
          {sent ? (
            <div className="badge badge-ok">✓ Message sent — we'll get back to you soon</div>
          ) : (
            <button className="btn btn-pri" disabled={busy}>{busy ? 'Sending…' : 'Send message'}</button>
          )}
        </form>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          {[
            ['💬 WhatsApp support', `Fastest way to reach us · ${contact.phone}`],
            ['✉ Email', `${contact.email} · replies in ~24h`],
            ['📍 Office', contact.address],
            ['🎫 Organizer support', `Payouts, KYC, listing issues → ${contact.organizerEmail}`],
          ].map(([t, d]) => (
            <div key={t} className="card">
              <h3 style={{ fontSize: 15, marginBottom: 4 }}>{t}</h3>
              <p className="muted small">{d}</p>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
