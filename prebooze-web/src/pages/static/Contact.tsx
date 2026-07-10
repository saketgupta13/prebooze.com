import { useState } from 'react';

export default function Contact() {
  const [sent, setSent] = useState(false);

  return (
    <main className="page">
      <div className="container profile-grid">
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            setSent(true);
          }}
        >
          <h1 style={{ fontSize: 24 }}>Get in touch</h1>
          <p className="muted small" style={{ margin: '6px 0 18px' }}>
            Questions about a booking, hosting, or partnerships — we usually reply within a day.
          </p>
          <div className="field">
            <span>Full name</span>
            <input required placeholder="Full name" />
          </div>
          <div className="field">
            <span>Email</span>
            <input required type="email" placeholder="you@mail.com" />
          </div>
          <div className="field">
            <span>I am a…</span>
            <select>
              <option>Guest</option>
              <option>Organizer</option>
              <option>Press</option>
            </select>
          </div>
          <div className="field">
            <span>Message</span>
            <textarea required placeholder="How can we help?" />
          </div>
          {sent ? (
            <div className="badge badge-ok">✓ Message sent — we'll get back to you soon</div>
          ) : (
            <button className="btn btn-pri">Send message</button>
          )}
        </form>

        <div style={{ display: 'grid', gap: 14, alignContent: 'start' }}>
          {[
            ['💬 WhatsApp support', 'Fastest way to reach us · +91 98765 43210'],
            ['✉ Email', 'help@prebooze.com · replies in ~24h'],
            ['📍 Office', '4th Floor, Cowork Hub, Koramangala, Bengaluru'],
            ['🎫 Organizer support', 'Payouts, KYC, listing issues → organizers@prebooze.com'],
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
