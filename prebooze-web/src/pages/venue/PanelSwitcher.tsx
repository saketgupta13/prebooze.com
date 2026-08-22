import { Link } from 'react-router-dom';

/** Top-of-sidebar tab pair shown in both VenueLayout and VenueOrgLayout so a
 * hosting-enabled venue can jump between its two separate panels — the venue
 * panel was previously the only one, this one gates behind hostingEnabled. */
export default function PanelSwitcher({ active }: { active: 'venue' | 'organizer' }) {
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
      <Link
        to="/venue"
        className={`btn btn-sm ${active === 'venue' ? 'btn-pri' : 'btn-ghost'}`}
        style={{ flex: 1, textAlign: 'center' }}
      >
        🏛 Venue panel
      </Link>
      <Link
        to="/venue/hosting"
        className={`btn btn-sm ${active === 'organizer' ? 'btn-pri' : 'btn-ghost'}`}
        style={{ flex: 1, textAlign: 'center' }}
      >
        🎪 Organizer panel
      </Link>
    </div>
  );
}
