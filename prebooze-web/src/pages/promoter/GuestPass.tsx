import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { fmtDate, fmtTime, minPrice } from '../../data/mock';
import { promoter as promoterApi, type PromoterPass } from '../../api';
import { cutoffDate, countdownLabel, isPassValid } from '../../lib/promoterPass';
import { eventLocation } from '../../lib/venue';
import { instagramHandle } from '../../lib/social';
import { usePlatformInfo } from '../../lib/usePlatformInfo';
import QRCode from '../../components/QRCode';
import Loader from '../../components/Loader';

/** The guest's free-entry pass — a QR that rotates every few seconds (screenshot-proof)
 * and is only valid before the cutoff. After the cutoff it flips to a paid-ticket CTA.
 * Fetched fresh from the real GET /p/pass/:id (public, no auth) instead of a local
 * mock array, so this survives a page refresh — the guest scans a QR at the gate,
 * not something living only in this browser tab's memory. */
export default function GuestPass() {
  const { id } = useParams();
  const [pass, setPass] = useState<PromoterPass | null>(null);
  const [loading, setLoading] = useState(true);
  const { socials } = usePlatformInfo();
  const igHandle = instagramHandle(socials.instagram);

  useEffect(() => {
    if (!id) return;
    promoterApi.pass(id).then(setPass).catch(() => setPass(null)).finally(() => setLoading(false));
  }, [id]);

  // tick every second for the countdown + rotate the QR seed every minute —
  // 5s was too fast for a real gate scan: the visual code could change out
  // from under a camera that was still mid-decode, before it ever locked
  // on. The rotation is a screenshot deterrent only (see checkIn's doc
  // comment — the server never validates it), so slowing it down doesn't
  // weaken anything real.
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <Loader />;

  if (!pass) {
    return (
      <main className="page">
        <div className="container center" style={{ padding: '80px 0' }}>
          <h1>Pass not found</h1>
          <Link to="/" className="btn btn-pri" style={{ marginTop: 18 }}>Home</Link>
        </div>
      </main>
    );
  }

  const { event } = pass;
  const venue = event.venue;
  const cutoff = cutoffDate(event);
  const valid = isPassValid(event);
  const rotation = Math.floor(now / 60000); // changes once a minute

  return (
    <main className="page">
      <div className="container confirm-hero">
        {valid ? (
          <>
            <div className="confirm-tick">✓</div>
            <h1 style={{ fontSize: 24 }}>You're on the list! 🎟️</h1>
            <p className="muted" style={{ margin: '8px 0 20px' }}>
              Sent to WhatsApp {pass.phone} · show this QR at the gate before it closes.
            </p>

            <div className="card card-shadow" style={{ textAlign: 'center' }}>
              <h2 style={{ fontSize: 20 }}>{event.title}</h2>
              {event.organizer?.brandName && (
                <div className="small accent" style={{ fontWeight: 700, margin: '2px 0' }}>
                  🎪 Hosted by {event.organizer.brandName}
                </div>
              )}
              <div className="muted small" style={{ margin: '6px 0 4px' }}>
                {fmtDate(event.date)} · {fmtTime(event.date)} · {eventLocation(event, venue)}
              </div>
              <div className="small" style={{ marginBottom: 14 }}>
                {pass.name}
                {(pass.companions?.length ?? 0) > 0 && <> + {pass.companions!.length} more</>}
                {' · '}<span className="badge badge-accent">Free entry</span>
              </div>
              {(pass.companions?.length ?? 0) > 0 && (
                <div className="tiny muted-2" style={{ marginBottom: 14, marginTop: -8 }}>
                  {[pass.name, ...pass.companions!.map((c) => c.name)].join(' · ')}
                </div>
              )}

              <QRCode value={`${pass.id}-${rotation}`} caption="one QR for the whole group · rotates every minute · screenshot-proof" />

              <div className="small bold" style={{ marginTop: 16 }}>Thanks for booking with Prebooze — see you there! 🎉</div>
              {igHandle && <div className="tiny accent" style={{ marginTop: 4 }}>📸 Follow us @{igHandle} on Instagram</div>}
              <div className="tiny muted-2" style={{ marginTop: 10 }}>
                Terms & conditions apply — <Link to="/legal/terms" className="link">www.prebooze.com/legal/terms</Link>
              </div>

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
              Arrive before the cutoff — after that this pass expires and you'll need a ticket.{' '}
              {(pass.companions?.length ?? 0) > 0
                ? 'Everyone in the group should carry ID matching the names above — arrive together, the gate scans once.'
                : `Carry ID matching "${pass.name}".`}
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
            <Link to={`/events/${event.slug}?ref=${pass.promoterSlug}`} className="btn btn-pri btn-lg">
              Get a ticket — from ₹{minPrice(event)} →
            </Link>
          </div>
        )}
      </div>
    </main>
  );
}
