import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Loader from '../../components/Loader';
import Accordion from '../../components/Accordion';
import { venuePartner, type VenueHostingRequest } from '../../api';
import { ApiError } from '../../api/client';

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });

/** Venue hosting opt-in + status + guide — this page is the entire Organizer
 * panel (VenueOrgLayout) until hostingEnabled flips true, at which point
 * that panel's real console nav appears alongside it. Requesting doesn't
 * unlock anything by itself: it creates a VenueHostingRequest that sits in
 * the admin queue until someone on our team has actually talked the venue
 * through the hosting rules (see VenueService.approveHostingRequest's
 * contactedAt gate) — most venues don't know these rules going in. */
export default function VenueHosting() {
  const [hostingEnabled, setHostingEnabled] = useState(false);
  const [request, setRequest] = useState<VenueHostingRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const load = () => {
    setLoading(true);
    venuePartner.hostingStatus()
      .then((s) => { setHostingEnabled(s.hostingEnabled); setRequest(s.request); })
      .catch((e) => setErr(e instanceof ApiError ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  const requestHosting = async () => {
    setBusy(true);
    setErr('');
    try {
      await venuePartner.requestHosting();
      load();
    } catch (e) {
      setErr(e instanceof ApiError ? e.message : 'Failed to send request');
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <Loader />;

  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 6 }}>🎪 Host your own events</h1>
      <p className="muted small" style={{ marginBottom: 18 }}>
        List and sell tickets for events you run yourself at your venue — solo, or together with a real organizer on
        Prebooze. You stay the ledger-of-record: every sale credits your own hosting balance, Prebooze only ever
        takes its usual commission.
      </p>
      {err && <div className="danger-text small" style={{ marginBottom: 12 }}>✕ {err}</div>}

      {hostingEnabled ? (
        <>
          <div className="card" style={{ borderColor: 'rgba(155,225,61,.4)', marginBottom: 18 }}>
            <div className="bold" style={{ marginBottom: 6 }}>✓ Hosting is enabled for your venue</div>
            <p className="small muted" style={{ marginBottom: 12 }}>
              You can create and manage your own events, with real ticket sales, from here.
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Link to="/venue/hosting/events" className="btn btn-pri btn-sm">🎟 Events I host →</Link>
              <Link to="/venue/hosting/ledger" className="btn btn-ghost btn-sm">💰 Hosting ledger →</Link>
            </div>
          </div>

          <div className="card">
            <h3 style={{ marginBottom: 12 }}>How to host — quick guide</h3>
            <Accordion title="Solo, or with an organizer?" defaultOpen>
              Host completely on your own, or tag a real, verified organizer on Prebooze as a collaborator — no
              invite needed, pick them like you'd pick a venue when creating an event elsewhere. Either way, your
              venue is the event's owner: it's your ledger, your dashboard, your call. Any revenue split with a
              collaborating organizer is worked out directly between the two of you — Prebooze doesn't move that
              money, only its own commission.
            </Accordion>
            <Accordion title="Approval, same as any event">
              A hosted event goes to admin review before it's bookable, same as any organizer's event. Once
              approved, it's live; rejections come back with a reason so you can fix and resubmit.
            </Accordion>
            <Accordion title="Getting paid">
              Every real sale on your hosted events credits your hosting ledger the moment a booking is confirmed —
              refunds debit it the same way. Check your running balance and full transaction history any time on the
              Hosting ledger page.
            </Accordion>
            <Accordion title="Rules to keep in mind">
              Same content and conduct guidelines as every event on Prebooze — accurate pricing, honest descriptions,
              and age-limit/ID checks at the door if you set one. Repeated guideline issues are reviewed the same
              way as an organizer's would be.
            </Accordion>
          </div>
        </>
      ) : request?.status === 'pending' ? (
        <div className="card" style={{ borderColor: 'var(--accent)' }}>
          <div className="bold" style={{ marginBottom: 6 }}>◌ Request sent — under review</div>
          <p className="small muted">
            Requested on {fmtDate(request.createdAt)}. Our team will reach out to walk you through hosting rules
            before switching this on — not every venue knows them going in, so we confirm with you first.
          </p>
        </div>
      ) : request?.status === 'rejected' ? (
        <div className="card" style={{ borderColor: 'var(--danger)' }}>
          <div className="bold" style={{ marginBottom: 6 }}>✕ Request not approved</div>
          {request.reviewNote && <p className="small muted" style={{ marginBottom: 12 }}>Reason: {request.reviewNote}</p>}
          <button className="btn btn-pri btn-sm" disabled={busy} onClick={requestHosting}>
            {busy ? 'Sending…' : 'Request again'}
          </button>
        </div>
      ) : (
        <div className="card">
          <div className="bold" style={{ marginBottom: 6 }}>Want to host your own events here?</div>
          <p className="small muted" style={{ marginBottom: 12 }}>
            Opt in and our team will reach out to confirm the hosting rules with you before enabling it — this
            doesn't unlock anything by itself.
          </p>
          <button className="btn btn-pri btn-sm" disabled={busy} onClick={requestHosting}>
            {busy ? 'Sending…' : 'Request to host events →'}
          </button>
        </div>
      )}
    </div>
  );
}
