import { Link } from 'react-router-dom';
import { useApp } from '../../store/AppContext';

/** Top-of-sidebar tab pair shown in both VenueLayout and VenueOrgLayout so a
 * hosting-enabled venue can jump between its two separate panels — the venue
 * panel was previously the only one, this one gates behind hostingEnabled.
 * An invited hosting-team member (not the venue owner) has no legitimate
 * access to the venue's own panel at all — that stays single-owner — so
 * they only ever see the Organizer panel, no switcher to click into. */
export default function PanelSwitcher({ active }: { active: 'venue' | 'organizer' }) {
  const { user } = useApp();
  if (!user?.isVenue) {
    return (
      <div className="btn btn-sm btn-pri" style={{ marginBottom: 14, textAlign: 'center', cursor: 'default' }}>
        🎪 Organizer panel
      </div>
    );
  }
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
