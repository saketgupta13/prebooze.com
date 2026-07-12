import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import { EVENTS, fmtDate, fmtTime, minPrice, venueById } from '../../data/mock';
import { cutoffDate, countdownLabel, isPassValid } from '../../lib/promoterPass';
import QRCode from '../../components/QRCode';

/** The guest's free-entry pass — a QR that rotates every few seconds (screenshot-proof)
 * and is only valid before the cutoff. After the cutoff it flips to a paid-ticket CTA. */
export default function GuestPass() {
  const { id } = useParams();
  const { promoterGuests, myEvents } = useApp();
  const guest = promoterGuests.find((g) => g.id === id);
  const event = guest ? [...myEvents, ...EVENTS].find((e) => e.id === guest.eventId) : undefined;

  // tick every second for the countdown + rotate the QR seed every 5s
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (!guest || !event) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Pass not found</h1>
          <Link to="/" className="btn btn-pri" style={{ marginTop: 18 }}>Home</Link>
        </div>
      </main>
    );
  }

  const venue = venueById(event.venueId);
  const cutoff = cutoffDate(event);
  const valid = isPassValid(event);
  const rotation = Math.floor(now / 5000); // changes every 5s

  return (
    <main className="page">
      <div className="container confirm-hero">
        {valid ? (
          <>
            <div className="confirm-tick">✓</div>
            <h1 style={{ fontSize: 24 }}>You're on the list! 🎟️</h1>
            <p className="muted" style={{ margin: '8px 0 20px' }}>
              Sent to WhatsApp {guest.phone} · show this QR at the gate before it closes.
            </p>

            <div className="card card-shadow" style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: 20 }}>{event.title}</h2>
              <div className="muted small" style={{ margin: '6px 0 4px' }}>
                {fmtDate(event.date)} · {fmtTime(event.date)} · {venue?.name}
              </div>
              <div className="small" style={{ marginBottom: 14 }}>
                {guest.name} · <span className="badge badge-accent">Free entry</span>
              </div>

              <QRCode seed={`${guest.id}-${rotation}`} caption="rotates every 5s · screenshot-proof" />

              {cutoff && (
                <div
                  style={{
                    marginTop: 16,
                    padding: '10px 14px',
                    borderRadius: 10,
                    border: '1.5px solid var(--accent)',
                    background: 'rgba(155,225,61,.08)',
                  }}
                >
                  <div className="tiny muted-2">Free entry closes in</div>
                  <div style={{ fontSize: 22, fontWeight: 800 }} className="accent">
                    {countdownLabel(cutoff)}
                  </div>
                  <div className="tiny muted-2">
                    at {cutoff.toLocaleString('en-US', { weekday: 'short', hour: 'numeric', minute: '2-digit' })}
                  </div>
                </div>
              )}
            </div>

            <div className="tiny muted-2" style={{ marginTop: 16 }}>
              Arrive before the cutoff — after that this pass expires and you'll need a ticket. Carry ID matching “{guest.name}”.
            </div>
          </>
        ) : (
          <div className="card card-shadow" style={{ textAlign: 'center' }}>
            <div className="confirm-tick" style={{ background: 'var(--danger)', color: '#fff' }}>✕</div>
            <h1 style={{ fontSize: 22, marginTop: 8 }}>Free window closed</h1>
            <p className="muted" style={{ margin: '10px 0 18px' }}>
              Free entry for <b>{event.title}</b> closed
              {cutoff && ` at ${cutoff.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' })}`}. You can
              still grab a ticket and come in.
            </p>
            <Link to={`/events/${event.slug}?ref=${guest.promoterSlug}`} className="btn btn-pri btn-lg">
              Get a ticket — from ₹{minPrice(event)} →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
