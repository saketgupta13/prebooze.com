import { Link, useParams } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { fmtDate, fmtTime } from '../../data/mock';
import { vip, type VipPass as VipPassData } from '../../api';
import { eventLocation } from '../../lib/venue';
import { instagramHandle } from '../../lib/social';
import { usePlatformInfo } from '../../lib/usePlatformInfo';
import QRCode from '../../components/QRCode';
import Loader from '../../components/Loader';

/** A personal invite from the organizer themselves — not a promoter's
 * free-entry link, and deliberately never time-gated (see
 * GuestListService/OrgGuestList.tsx: no cutoff concept exists for this
 * list at all, unlike promoter passes). One shared QR for the whole
 * party, same as the promoter pass — the main guest holds it, everyone
 * arrives together, the gate scans once. Fetched fresh from the real
 * GET /vip/pass/:id (public, no auth) so it survives a refresh, same
 * reasoning as GuestPass.tsx. */
export default function VipPass() {
  const { id } = useParams();
  const [pass, setPass] = useState<VipPassData | null>(null);
  const [loading, setLoading] = useState(true);
  const { socials } = usePlatformInfo();
  const igHandle = instagramHandle(socials.instagram);

  useEffect(() => {
    if (!id) return;
    vip.pass(id).then(setPass).catch(() => setPass(null)).finally(() => setLoading(false));
  }, [id]);

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
  const party = [pass.name, ...pass.companions.map((c) => c.name)];

  return (
    <main className="page">
      <div className="container confirm-hero">
        <div className="confirm-tick" style={{ background: '#f0b429', color: '#1a1300' }}>✨</div>
        <h1 style={{ fontSize: 24 }}>You're invited! ✨</h1>
        <p className="muted" style={{ margin: '8px 0 20px' }}>
          {event.organizer?.brandName ?? 'The organizer'} personally added you to the list — sent to WhatsApp {pass.phone}.
        </p>

        <div className="card card-shadow" style={{ textAlign: 'center' }}>
          <span
            className="badge"
            style={{ background: 'rgba(240,180,41,.16)', color: '#f0b429', marginBottom: 10, display: 'inline-block' }}
          >
            ✨ VIP Invite
          </span>
          <h2 style={{ fontSize: 20, marginTop: 8 }}>{event.title}</h2>
          {event.organizer?.brandName && (
            <div className="small" style={{ fontWeight: 700, margin: '2px 0', color: '#f0b429' }}>
              🎪 Hosted by {event.organizer.brandName}
            </div>
          )}
          <div className="muted small" style={{ margin: '6px 0 14px' }}>
            {fmtDate(event.date)} · {fmtTime(event.date)} · {eventLocation(event, venue)}
          </div>

          <div className="small" style={{ marginBottom: 4 }}>
            {party.length > 1 ? `${pass.name} + ${party.length - 1} more` : pass.name}
          </div>
          {party.length > 1 && (
            <div className="tiny muted-2" style={{ marginBottom: 14 }}>
              {party.join(' · ')}
            </div>
          )}

          <QRCode value={`vip-${pass.id}`} caption="one QR for the whole group · show it at the gate" />

          <div className="small bold" style={{ marginTop: 16 }}>Thanks for booking with Prebooze — see you there! 🎉</div>
          {igHandle && <div className="tiny accent" style={{ marginTop: 4 }}>📸 Follow us @{igHandle} on Instagram</div>}
          <div className="tiny muted-2" style={{ marginTop: 10 }}>
            Terms & conditions apply — <Link to="/legal/terms" className="link">prebooze.com/legal/terms</Link>
          </div>
        </div>

        <div className="tiny muted-2" style={{ marginTop: 16 }}>
          This pass never expires or closes — arrive whenever works for you.{' '}
          {party.length > 1
            ? 'Everyone in the group should carry ID matching the names above — arrive together, the gate scans once.'
            : `Carry ID matching "${pass.name}".`}
        </div>
      </div>
    </main>
  );
}
