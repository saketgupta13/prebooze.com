import { Navigate, NavLink, Outlet } from 'react-router-dom';
import { useApp } from '../../store/AppContext';
import PendingReview, { RejectedReview } from '../../components/PendingReview';
import PanelSwitcher from './PanelSwitcher';

const NAV = [
  { to: '/venue', label: '▦ Dashboard', end: true },
  { to: '/venue/listing', label: '🏛 My listing' },
  { to: '/venue/events', label: '📅 Events here' },
  { to: '/venue/reviews', label: '★ Reviews' },
  { to: '/venue/billing', label: '⭐ Featured & billing' },
  { to: '/venue/settings', label: '⚙ Settings' },
];

/** The venue's own identity/listing panel — nothing about hosting events
 * lives here any more (see VenueOrgLayout for that, a fully separate panel
 * reachable via the switcher below). Keeping these two panels structurally
 * separate, rather than one merged sidebar, is a deliberate call: a venue
 * and the events it might host are different concerns with different
 * audiences, and merging them read as confusing in practice. */
export default function VenueLayout() {
  const { user } = useApp();

  if (!user) return <Navigate to="/login" state={{ from: '/venue' }} replace />;
  if (!user.isVenue) {
    if (user.pendingRole === 'venue' && user.roleStatus === 'pending') return <PendingReview role="venue" />;
    if (user.pendingRole === 'venue' && user.roleStatus === 'rejected') return <RejectedReview role="venue" reason={user.roleRejectionReason} />;
    return <Navigate to="/venue/onboarding" replace />;
  }

  return (
    <main className="page">
      <div className="container org-layout">
        <aside className="org-side">
          <PanelSwitcher active="venue" />
          <div className="cap">VENUE</div>
          {NAV.map((n) => (
            <NavLink key={n.to} to={n.to} end={n.end} className={({ isActive }) => (isActive ? 'on' : '')}>
              {n.label}
            </NavLink>
          ))}
        </aside>
        <div style={{ minWidth: 0 }}>
          <Outlet />
        </div>
      </div>
    </main>
  );
}
