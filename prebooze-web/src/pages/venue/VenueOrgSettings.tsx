import { Link } from 'react-router-dom';

/** Organizer panel's Settings — unlike organizer/Settings.tsx, this doesn't
 * duplicate business-profile fields (name, logo, contact, socials,
 * verification, payment profiles): those already live in exactly one place,
 * the venue's own listing (Venue panel), and there's no reason to split
 * that data across two forms for the same Venue row. What's genuinely
 * specific to hosting is team access, so that's what lives here. */
export default function VenueOrgSettings() {
  return (
    <div>
      <h1 style={{ fontSize: 24, marginBottom: 18 }}>Settings</h1>
      <div className="card">
        <div className="evrow">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Team & roles</div>
            <div className="tiny muted">door-scan access, managers</div>
          </div>
          <Link to="/venue/hosting/team" className="btn btn-ghost btn-sm">Manage →</Link>
        </div>
        <div className="evrow">
          <div style={{ flex: 1, minWidth: 0 }}>
            <div className="bold small">Venue profile & payout details</div>
            <div className="tiny muted">name, logo, bank details, verification — all on the venue panel</div>
          </div>
          <Link to="/venue/settings" className="btn btn-ghost btn-sm">Manage →</Link>
        </div>
      </div>
    </div>
  );
}
